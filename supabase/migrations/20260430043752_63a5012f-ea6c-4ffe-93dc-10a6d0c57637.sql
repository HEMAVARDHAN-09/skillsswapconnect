CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(user_id uuid, name text, email text, credits integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.email, p.credits
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;