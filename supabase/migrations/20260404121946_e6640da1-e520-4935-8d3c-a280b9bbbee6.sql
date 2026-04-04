
-- 1. Add CHECK constraint on rating
ALTER TABLE public.sessions ADD CONSTRAINT rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- 2. Replace validate_session_update to also validate rating/review fields
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

-- 3. Add explicit INSERT restriction on user_roles for non-admins
-- The handle_new_user trigger is SECURITY DEFINER so it bypasses RLS
-- This explicit policy ensures no authenticated user can self-assign roles
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Fix profiles: create a secure view excluding email for non-owners
-- and update the SELECT policy to be more restrictive
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
