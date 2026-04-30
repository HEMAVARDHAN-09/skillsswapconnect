-- Harden profile reads so sensitive fields remain owner/admin-only
DROP POLICY IF EXISTS "Users can view own profile and admins can view all" ON public.profiles;

CREATE POLICY "Profiles full data visible to owner and admins only"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Shared profile lookup intentionally exposes only safe fields and only when there is a relationship
CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
RETURNS TABLE(user_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND auth.uid() IS NOT NULL
    AND (
      p.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.sessions s
        WHERE (s.teacher_id = auth.uid() AND s.learner_id = p.user_id)
           OR (s.learner_id = auth.uid() AND s.teacher_id = p.user_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.chat_rooms cr
        WHERE (cr.user1_id = auth.uid() AND cr.user2_id = p.user_id)
           OR (cr.user2_id = auth.uid() AND cr.user1_id = p.user_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- Leaderboard is the only shared surface that intentionally exposes credit totals, limited to ranked users
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
  WHERE auth.uid() IS NOT NULL
  GROUP BY p.user_id, p.name, p.credits
  ORDER BY p.credits DESC, p.name ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 5), 25));
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;