CREATE OR REPLACE FUNCTION public.validate_session_update(_session_id uuid, _user_id uuid, _new_status text, _old_status text, _new_teacher_id uuid, _old_teacher_id uuid, _new_learner_id uuid, _old_learner_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Cannot change participant IDs
  IF _new_teacher_id IS DISTINCT FROM _old_teacher_id OR _new_learner_id IS DISTINCT FROM _old_learner_id THEN
    RETURN false;
  END IF;

  -- Validate status transitions
  IF _new_status IS DISTINCT FROM _old_status THEN
    IF NOT (
      (_old_status = 'pending' AND _new_status IN ('accepted', 'rejected')) OR
      (_old_status = 'accepted' AND _new_status IN ('confirmed', 'completed', 'cancelled')) OR
      (_old_status = 'confirmed' AND _new_status IN ('completed', 'cancelled'))
    ) THEN
      RETURN false;
    END IF;

    -- Only teacher can accept/reject/confirm
    IF _new_status IN ('accepted', 'rejected', 'confirmed') AND _user_id != _old_teacher_id THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$function$;