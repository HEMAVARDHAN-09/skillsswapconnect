-- Make role management explicitly signed-in admin only
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Remove direct client notification creation; backend triggers can still create notifications
DROP POLICY IF EXISTS "Trigger inserts notifications" ON public.notifications;

-- Restrict public-role policies to signed-in users where the app requires auth
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create sessions" ON public.sessions;
CREATE POLICY "Users can create sessions"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = learner_id);

DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
CREATE POLICY "Users can view own sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING ((auth.uid() = teacher_id) OR (auth.uid() = learner_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete sessions" ON public.sessions;
CREATE POLICY "Admins can delete sessions"
ON public.sessions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only teachers can mark sessions complete
CREATE OR REPLACE FUNCTION public.validate_session_update(_session_id uuid, _user_id uuid, _new_status text, _old_status text, _new_teacher_id uuid, _old_teacher_id uuid, _new_learner_id uuid, _old_learner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _new_teacher_id IS DISTINCT FROM _old_teacher_id OR _new_learner_id IS DISTINCT FROM _old_learner_id THEN
    RETURN false;
  END IF;

  IF _new_status IS DISTINCT FROM _old_status THEN
    IF NOT (
      (_old_status = 'pending' AND _new_status IN ('accepted', 'rejected')) OR
      (_old_status = 'accepted' AND _new_status IN ('confirmed', 'cancelled')) OR
      (_old_status = 'confirmed' AND _new_status IN ('completed', 'cancelled'))
    ) THEN
      RETURN false;
    END IF;

    IF _new_status IN ('accepted', 'rejected', 'confirmed', 'completed') AND _user_id != _old_teacher_id THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_record public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO session_record FROM public.sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> session_record.teacher_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF session_record.status <> 'confirmed' THEN RAISE EXCEPTION 'Session cannot be completed from current status'; END IF;

  UPDATE public.sessions SET status = 'completed', updated_at = now() WHERE id = _session_id;
  PERFORM set_config('app.allow_profile_credit_update', 'true', true);
  UPDATE public.profiles SET credits = credits + 1, updated_at = now() WHERE user_id = session_record.teacher_id;
  UPDATE public.profiles SET credits = GREATEST(0, credits - 1), updated_at = now() WHERE user_id = session_record.learner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_session(uuid) TO authenticated;