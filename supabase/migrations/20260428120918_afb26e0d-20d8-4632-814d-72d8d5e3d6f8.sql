-- Restrict sensitive profile rows to owners and admins only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile and admins can view all" ON public.profiles;

CREATE POLICY "Users can view own profile and admins can view all"
ON public.profiles
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Safe helper for looking up public display names without exposing emails/credits
CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE(user_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- Safe leaderboard helper for the intentional top-credits leaderboard display
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 5)
RETURNS TABLE(user_id uuid, name text, credits integer, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.name,
    p.credits,
    COALESCE(ROUND(AVG(s.rating)::numeric, 1), 0) AS avg_rating
  FROM public.profiles p
  LEFT JOIN public.sessions s
    ON s.teacher_id = p.user_id
   AND s.rating IS NOT NULL
  GROUP BY p.user_id, p.name, p.credits
  ORDER BY p.credits DESC, p.name ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 5), 25));
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;

-- Lock down Realtime private channel subscriptions by topic
DROP POLICY IF EXISTS "Users can subscribe to own dashboard realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Users can subscribe to participant chat realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Users can subscribe to participant session realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Admins can subscribe to own notification realtime" ON realtime.messages;

CREATE POLICY "Users can subscribe to own dashboard realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (realtime.topic() = ('dashboard-sessions-' || auth.uid()::text));

CREATE POLICY "Users can subscribe to participant chat realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'chat-%'
  AND EXISTS (
    SELECT 1
    FROM public.chat_rooms cr
    WHERE cr.id::text = regexp_replace(realtime.topic(), '^chat-', '')
      AND (cr.user1_id = auth.uid() OR cr.user2_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Users can subscribe to participant session realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'session-end-%'
  AND EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id::text = regexp_replace(realtime.topic(), '^session-end-', '')
      AND (s.teacher_id = auth.uid() OR s.learner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Admins can subscribe to own notification realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('admin-notifications-watch-' || auth.uid()::text)
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);