
-- 1. Fix ban bypass: allow users to read their own ban record
CREATE POLICY "Users can view own ban"
  ON public.user_bans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Fix profiles public email exposure: replace open SELECT with authenticated-only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3. Add admin UPDATE policy on user_bans
CREATE POLICY "Admins can update bans"
  ON public.user_bans FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Fix sessions UPDATE: create a validation function and replace the policy
CREATE OR REPLACE FUNCTION public.validate_session_update(
  _session_id uuid,
  _user_id uuid,
  _new_status text,
  _old_status text,
  _new_teacher_id uuid,
  _old_teacher_id uuid,
  _new_learner_id uuid,
  _old_learner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cannot change participant IDs
  IF _new_teacher_id IS DISTINCT FROM _old_teacher_id OR _new_learner_id IS DISTINCT FROM _old_learner_id THEN
    RETURN false;
  END IF;

  -- Validate status transitions
  IF _new_status IS DISTINCT FROM _old_status THEN
    -- Only allow: pending->accepted, pending->rejected, accepted->completed, accepted->cancelled
    IF NOT (
      (_old_status = 'pending' AND _new_status IN ('accepted', 'rejected')) OR
      (_old_status = 'accepted' AND _new_status IN ('completed', 'cancelled'))
    ) THEN
      RETURN false;
    END IF;

    -- Only teacher can accept/reject
    IF _new_status IN ('accepted', 'rejected') AND _user_id != _old_teacher_id THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

DROP POLICY IF EXISTS "Session participants can update" ON public.sessions;

CREATE POLICY "Session participants can update"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = teacher_id OR auth.uid() = learner_id)
  WITH CHECK (
    validate_session_update(
      id, auth.uid(),
      status, (SELECT s.status FROM public.sessions s WHERE s.id = sessions.id),
      teacher_id, (SELECT s.teacher_id FROM public.sessions s WHERE s.id = sessions.id),
      learner_id, (SELECT s.learner_id FROM public.sessions s WHERE s.id = sessions.id)
    )
  );
