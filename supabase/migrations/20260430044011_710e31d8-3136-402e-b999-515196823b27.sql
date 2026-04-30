CREATE POLICY "Users can subscribe to own notification realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('notifications-' || auth.uid()::text)
);