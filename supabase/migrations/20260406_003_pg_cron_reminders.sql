-- ==================== PG_CRON: DISPARADOR DE LEMBRETES ====================
-- IMPORTANTE: execute isso no Supabase SQL Editor (não via migration automática)
-- O pg_cron precisa ser habilitado em: Database → Extensions → pg_cron

-- Habilita extensão pg_cron (se não estiver habilitada)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agenda o disparo da Edge Function a cada 1 minuto
-- SUBSTITUA <SERVICE_ROLE_KEY> pela sua service role key real

SELECT cron.schedule(
  'send-reminders-every-minute',    -- nome do job
  '* * * * *',                       -- cron: a cada 1 minuto
  $$
  SELECT
    net.http_post(
      url := 'https://fnilyapvhhygfzcdxqjm.supabase.co/functions/v1/send-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    )
  $$
);

-- Para verificar o job:
-- SELECT * FROM cron.job;

-- Para remover o job (se necessário):
-- SELECT cron.unschedule('send-reminders-every-minute');
