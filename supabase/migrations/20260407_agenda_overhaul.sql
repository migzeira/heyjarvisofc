-- =============================================
-- AGENDA OVERHAUL — New columns for events table
-- =============================================

-- Add new columns to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'compromisso';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS color text;

-- Add check constraints for valid values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_event_type_check'
  ) THEN
    ALTER TABLE public.events ADD CONSTRAINT events_event_type_check
      CHECK (event_type IN ('compromisso', 'reuniao', 'consulta', 'evento', 'tarefa'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_priority_check'
  ) THEN
    ALTER TABLE public.events ADD CONSTRAINT events_priority_check
      CHECK (priority IN ('baixa', 'media', 'alta'));
  END IF;
END $$;

-- Index for faster date-range queries
CREATE INDEX IF NOT EXISTS idx_events_user_date
  ON public.events (user_id, event_date);

CREATE INDEX IF NOT EXISTS idx_events_user_status_date
  ON public.events (user_id, status, event_date);
