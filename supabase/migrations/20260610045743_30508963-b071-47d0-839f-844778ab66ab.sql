
-- 1. Audit log table
CREATE TABLE public.rpc_audit_log (
  id BIGSERIAL PRIMARY KEY,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  caller_id UUID,
  function_name TEXT NOT NULL,
  args JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);

CREATE INDEX idx_rpc_audit_log_called_at ON public.rpc_audit_log (called_at DESC);
CREATE INDEX idx_rpc_audit_log_caller ON public.rpc_audit_log (caller_id, called_at DESC);
CREATE INDEX idx_rpc_audit_log_function ON public.rpc_audit_log (function_name, called_at DESC);

GRANT SELECT ON public.rpc_audit_log TO authenticated;
GRANT ALL ON public.rpc_audit_log TO service_role;

ALTER TABLE public.rpc_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
ON public.rpc_audit_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Internal log writer (SECURITY DEFINER, not user-callable directly via PostgREST grant)
CREATE OR REPLACE FUNCTION public.log_rpc_call(
  _function_name TEXT,
  _args JSONB,
  _success BOOLEAN DEFAULT true,
  _error_message TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rpc_audit_log (caller_id, function_name, args, success, error_message)
  VALUES (auth.uid(), _function_name, _args, _success, _error_message);
EXCEPTION WHEN OTHERS THEN
  -- Never let logging failure break the wrapped RPC
  NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_rpc_call(TEXT, JSONB, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

-- 3. Wrap the 6 user-callable RPCs with logging

-- get_my_profile
CREATE OR REPLACE FUNCTION public.get_my_profile()
 RETURNS TABLE(user_id uuid, name text, email text, credits integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.log_rpc_call('get_my_profile', '{}'::jsonb);
  RETURN QUERY
  SELECT p.user_id, p.name, p.email, p.credits
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
END;
$function$;

-- get_leaderboard
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 5)
 RETURNS TABLE(user_id uuid, name text, credits integer, avg_rating numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.log_rpc_call('get_leaderboard', jsonb_build_object('_limit', _limit));
  RETURN QUERY
  SELECT
    p.user_id,
    p.name,
    p.credits,
    COALESCE(ROUND(AVG(s.rating)::numeric, 1), 0) AS avg_rating
  FROM public.profiles p
  LEFT JOIN public.sessions s
    ON s.teacher_id = p.user_id
   AND s.rating IS NOT NULL
  WHERE auth.uid() IS NOT NULL
  GROUP BY p.user_id, p.name, p.credits
  ORDER BY p.credits DESC, p.name ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 5), 25));
END;
$function$;

-- get_public_profiles
CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
 RETURNS TABLE(user_id uuid, name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.log_rpc_call('get_public_profiles', jsonb_build_object('count', COALESCE(array_length(_user_ids,1),0)));
  RETURN QUERY
  SELECT p.user_id, p.name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND auth.uid() IS NOT NULL
    AND (
      p.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE (s.teacher_id = auth.uid() AND s.learner_id = p.user_id)
           OR (s.learner_id = auth.uid() AND s.teacher_id = p.user_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.chat_rooms cr
        WHERE (cr.user1_id = auth.uid() AND cr.user2_id = p.user_id)
           OR (cr.user2_id = auth.uid() AND cr.user1_id = p.user_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.skills learner_skill
        JOIN public.skills teacher_skill
          ON teacher_skill.skill_name = learner_skill.skill_name
         AND teacher_skill.type = 'Teach'
         AND teacher_skill.user_id = p.user_id
        WHERE learner_skill.user_id = auth.uid()
          AND learner_skill.type = 'Learn'
      )
    );
END;
$function$;

-- complete_session
CREATE OR REPLACE FUNCTION public.complete_session(_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_record public.sessions%ROWTYPE;
BEGIN
  BEGIN
    SELECT * INTO session_record FROM public.sessions WHERE id = _session_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF auth.uid() IS NULL OR auth.uid() <> session_record.teacher_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
    IF session_record.status <> 'confirmed' THEN RAISE EXCEPTION 'Session cannot be completed from current status'; END IF;

    UPDATE public.sessions SET status = 'completed', updated_at = now() WHERE id = _session_id;
    PERFORM set_config('app.allow_profile_credit_update', 'true', true);
    UPDATE public.profiles SET credits = credits + 1, updated_at = now() WHERE user_id = session_record.teacher_id;
    UPDATE public.profiles SET credits = GREATEST(0, credits - 1), updated_at = now() WHERE user_id = session_record.learner_id;

    PERFORM public.log_rpc_call('complete_session', jsonb_build_object('_session_id', _session_id), true, NULL);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_rpc_call('complete_session', jsonb_build_object('_session_id', _session_id), false, SQLERRM);
    RAISE;
  END;
END;
$function$;

-- has_role and validate_session_update are called from RLS policies on every query;
-- logging each call would create extreme write amplification. We deliberately do NOT
-- log them per call. They remain SECURITY DEFINER for RLS use only.

-- 4. Suspicious activity helper (admin only)
CREATE OR REPLACE FUNCTION public.get_suspicious_rpc_activity(_minutes integer DEFAULT 60, _threshold integer DEFAULT 100)
 RETURNS TABLE(caller_id uuid, function_name text, call_count bigint, failure_count bigint, last_call timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    l.caller_id,
    l.function_name,
    COUNT(*) AS call_count,
    COUNT(*) FILTER (WHERE NOT l.success) AS failure_count,
    MAX(l.called_at) AS last_call
  FROM public.rpc_audit_log l
  WHERE l.called_at > now() - make_interval(mins => GREATEST(1, _minutes))
  GROUP BY l.caller_id, l.function_name
  HAVING COUNT(*) >= GREATEST(1, _threshold)
  ORDER BY call_count DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_suspicious_rpc_activity(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_suspicious_rpc_activity(integer, integer) TO authenticated;
