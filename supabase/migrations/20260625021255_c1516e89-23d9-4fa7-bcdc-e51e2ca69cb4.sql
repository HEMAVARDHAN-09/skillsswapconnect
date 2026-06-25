
-- 1. Ban enforcement helper
CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE user_id = _user_id
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Apply restrictive ban policy to sensitive tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sessions','skills','chat_rooms','chat_messages','profiles','notifications','reports']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Banned users denied" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Banned users denied" ON public.%I AS RESTRICTIVE TO authenticated USING (NOT public.is_user_banned(auth.uid())) WITH CHECK (NOT public.is_user_banned(auth.uid()))',
      t
    );
  END LOOP;
END $$;

-- 2. Rating integrity trigger on sessions
CREATE OR REPLACE FUNCTION public.enforce_rating_rules()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only act when rating/review actually change
  IF NEW.rating IS DISTINCT FROM OLD.rating OR NEW.review IS DISTINCT FROM OLD.review THEN
    -- Bypass for admins and service contexts (no auth.uid())
    IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RETURN NEW;
    END IF;

    -- Only the learner can write ratings/reviews
    IF auth.uid() <> OLD.learner_id THEN
      RAISE EXCEPTION 'Only the learner may submit a rating or review';
    END IF;

    -- Session must be completed
    IF OLD.status <> 'completed' THEN
      RAISE EXCEPTION 'Ratings can only be submitted on completed sessions';
    END IF;

    -- Cannot overwrite an existing rating/review
    IF OLD.rating IS NOT NULL AND NEW.rating IS DISTINCT FROM OLD.rating THEN
      RAISE EXCEPTION 'Rating cannot be modified once submitted';
    END IF;
    IF OLD.review IS NOT NULL AND NEW.review IS DISTINCT FROM OLD.review THEN
      RAISE EXCEPTION 'Review cannot be modified once submitted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_rating_rules_trg ON public.sessions;
CREATE TRIGGER enforce_rating_rules_trg
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rating_rules();

-- 3. Tighten skills SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view skills" ON public.skills;
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
    OR (
      skills.type = 'Teach'
      AND EXISTS (
        SELECT 1 FROM public.skills my_learn
        WHERE my_learn.user_id = auth.uid()
          AND my_learn.type = 'Learn'
          AND my_learn.skill_name = skills.skill_name
      )
    )
  );
