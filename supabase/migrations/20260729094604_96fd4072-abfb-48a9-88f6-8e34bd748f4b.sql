
-- Helper to check "target user teaches a skill I want to learn" without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.can_view_teacher_skill(_viewer uuid, _target uuid, _skill_name text, _type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _type = 'Teach' AND EXISTS (
    SELECT 1 FROM public.skills my_learn
    WHERE my_learn.user_id = _viewer
      AND my_learn.type = 'Learn'
      AND my_learn.skill_name = _skill_name
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_teacher_skill(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_teacher_skill(uuid, uuid, text, text) TO authenticated;

DROP POLICY IF EXISTS "Users can view scoped skills" ON public.skills;

CREATE POLICY "Users can view scoped skills"
ON public.skills
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE (s.teacher_id = auth.uid() AND s.learner_id = skills.user_id)
       OR (s.learner_id = auth.uid() AND s.teacher_id = skills.user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.chat_rooms cr
    WHERE (cr.user1_id = auth.uid() AND cr.user2_id = skills.user_id)
       OR (cr.user2_id = auth.uid() AND cr.user1_id = skills.user_id)
  )
  OR public.can_view_teacher_skill(auth.uid(), skills.user_id, skills.skill_name, skills.type)
);
