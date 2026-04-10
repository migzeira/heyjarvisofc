-- Atualiza o cron job do send-reminder pra passar o CRON_SECRET via header
-- customizado x-cron-secret (pra não conflitar com Authorization do pg_net).
--
-- Lê CRON_SECRET do vault.decrypted_secrets (seguro, não hardcoded).
-- Se o secret não estiver no vault, o job continua funcionando porque a edge
-- function só valida quando o secret está configurado (dev mode aceita tudo).
--
-- Idempotente: reschedula o mesmo job com a nova definição.

-- Remove job antigo
DO $$
BEGIN
  PERFORM cron.unschedule('send-reminders-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Recria com header x-cron-secret lido do vault
SELECT cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://fnilyapvhhygfzcdxqjm.supabase.co/functions/v1/send-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1),
        ''
      )
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
