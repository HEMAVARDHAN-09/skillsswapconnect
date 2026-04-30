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
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;