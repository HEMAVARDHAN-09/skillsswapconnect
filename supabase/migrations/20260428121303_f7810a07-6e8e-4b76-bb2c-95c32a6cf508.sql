CREATE OR REPLACE FUNCTION public.prevent_unsafe_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_profile_credit_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.credits IS DISTINCT FROM OLD.credits THEN
      RAISE EXCEPTION 'Profile protected fields cannot be changed directly';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unsafe_profile_update_trigger ON public.profiles;
CREATE TRIGGER prevent_unsafe_profile_update_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unsafe_profile_update();

CREATE OR REPLACE FUNCTION public.complete_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_record public.sessions%ROWTYPE;
BEGIN
  SELECT *
  INTO session_record
  FROM public.sessions
  WHERE id = _session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() <> session_record.teacher_id AND auth.uid() <> session_record.learner_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF session_record.status NOT IN ('accepted', 'confirmed') THEN
    RAISE EXCEPTION 'Session cannot be completed from current status';
  END IF;

  UPDATE public.sessions
  SET status = 'completed', updated_at = now()
  WHERE id = _session_id;

  PERFORM set_config('app.allow_profile_credit_update', 'true', true);

  UPDATE public.profiles
  SET credits = credits + 1, updated_at = now()
  WHERE user_id = session_record.teacher_id;

  UPDATE public.profiles
  SET credits = GREATEST(0, credits - 1), updated_at = now()
  WHERE user_id = session_record.learner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_unsafe_profile_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_session(uuid) TO authenticated;