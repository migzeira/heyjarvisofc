-- Ativa as extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job antigo se existir
SELECT cron.unschedule('send-reminders-every-minute')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-reminders-every-minute'
);

-- Cria cron job que chama a Edge Function a cada 1 minuto
SELECT cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://fnilyapvhhygfzcdxqjm.supabase.co/functions/v1/send-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer maya-cron-secret-2026'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
