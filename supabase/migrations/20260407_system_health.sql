-- Tabela de status atual (upsert por service)
CREATE TABLE IF NOT EXISTS system_health (
  service       TEXT PRIMARY KEY,
  is_online     BOOLEAN NOT NULL DEFAULT false,
  status_detail TEXT,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de histórico para calcular falhas consecutivas
CREATE TABLE IF NOT EXISTS system_health_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service       TEXT NOT NULL,
  is_online     BOOLEAN NOT NULL,
  status_detail TEXT,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar logs recentes por serviço
CREATE INDEX IF NOT EXISTS idx_health_log_service_time
  ON system_health_log (service, checked_at DESC);

-- Adicionar coluna severity em error_logs se não existir
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'error';

-- pg_cron: health check a cada 5 minutos
SELECT cron.schedule(
  'monitor-evolution-health',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fnilyapvhhygfzcdxqjm.supabase.co/functions/v1/monitor-health',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer maya-cron-secret-2026"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
