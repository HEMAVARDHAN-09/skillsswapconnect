
-- Add scheduling columns to sessions table
ALTER TABLE public.sessions 
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS start_time time without time zone,
  ADD COLUMN IF NOT EXISTS end_time time without time zone,
  ADD COLUMN IF NOT EXISTS meeting_type text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;
