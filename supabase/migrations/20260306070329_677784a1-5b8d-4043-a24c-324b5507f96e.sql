
-- Tighten the insert policy: only allow inserts where user_id matches the caller
-- (the trigger uses SECURITY DEFINER so it bypasses RLS anyway)
DROP POLICY "System can insert notifications" ON public.notifications;
CREATE POLICY "Trigger inserts notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
