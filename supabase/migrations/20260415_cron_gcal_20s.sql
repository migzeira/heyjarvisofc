-- Cron de Google Calendar a cada 20 segundos
-- pg_cron não suporta sub-minute nativamente, então usamos 3 jobs defasados
-- via pg_sleep: 0s, 20s, 40s → resultado: chamada a cada ~20s.
--
-- Lógica de "settle window" no edge function previne notificações duplicadas
-- de "evento atualizado" pra eventos criados nos últimos 5 min.

DO $$
BEGIN
  PERFORM cron.unschedule('google-calendar-poll-every-1min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('google-calendar-poll-every-2min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('gcal-poll-0s');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('gcal-poll-20s');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('gcal-poll-40s');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Job 0s: dispara no segundo :00 de cada minuto
SELECT cron.schedule(
  'gcal-poll-0s',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://fnilyapvhhygfzcdxqjm.supabase.co/functions/v1/google-calendar-poll',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'maya-cron-secret-2026'),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Job 20s: dorme 20s e dispara
SELECT cron.schedule(
  'gcal-poll-20s',
  '* * * * *',
  $$
  SELECT pg_sleep(20);
  SELECT net.http_post(
    url     := 'https://fnilyapvhhygfzcdxqjm.supabase.co/functions/v1/google-calendar-poll',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'maya-cron-secret-2026'),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Job 40s: dorme 40s e dispara
SELECT cron.schedule(
  'gcal-poll-40s',
  '* * * * *',
  $$
  SELECT pg_sleep(40);
  SELECT net.http_post(
    url     := 'https://fnilyapvhhygfzcdxqjm.supabase.co/functions/v1/google-calendar-poll',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'maya-cron-secret-2026'),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
