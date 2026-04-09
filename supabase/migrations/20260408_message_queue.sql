-- message_queue: fila de mensagens com retry para Evolution API
CREATE TABLE IF NOT EXISTS public.message_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone        TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'image' | 'buttons'
  content      TEXT NOT NULL,                  -- texto ou JSON para imagem/botoes
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ
);

-- Index para o worker: busca mensagens pendentes prontas para envio
CREATE INDEX IF NOT EXISTS idx_message_queue_pending
  ON public.message_queue (next_attempt_at, status)
  WHERE status = 'pending';

-- RLS: somente service role acessa
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.message_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- pg_cron: processa fila a cada minuto
SELECT cron.schedule(
  'process-message-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url      := (SELECT value FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/process-message-queue',
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body     := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
