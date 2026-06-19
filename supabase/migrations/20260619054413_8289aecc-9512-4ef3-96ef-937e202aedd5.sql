DROP POLICY IF EXISTS "Anyone can view skills" ON public.skills;
CREATE POLICY "Authenticated users can view skills" ON public.skills FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.skills FROM anon;