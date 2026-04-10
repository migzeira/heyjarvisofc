-- Fase A Segurança — habilita RLS em tabelas internas que ficaram sem RLS.
--
-- Nenhuma dessas 4 tabelas contém dados pessoais do usuário expostos por user_id —
-- elas são tabelas operacionais internas (logs de eventos externos, rate limit por
-- telefone, health checks). Mas manter sem RLS é um risco: se a anon key vazar ou
-- alguém descobrir como chamar Supabase REST com ela, pode ler dados operacionais.
--
-- Política aplicada: bloquear tudo exceto service_role (que é o que as edge functions
-- usam). Usuários autenticados não têm acesso a essas tabelas — isso é o desejado
-- porque nenhuma feature cliente-facing precisa ler esses dados.

-- ────────────────────────────────────────────────────────────────
-- 1. kirvano_events — eventos do webhook Kirvano
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.kirvano_events ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas se existirem (idempotente)
DROP POLICY IF EXISTS "service_role_only_kirvano_events" ON public.kirvano_events;
DROP POLICY IF EXISTS "admin_read_kirvano_events" ON public.kirvano_events;

-- Service role tem acesso total (webhook Kirvano precisa INSERT)
CREATE POLICY "service_role_only_kirvano_events" ON public.kirvano_events
  FOR ALL USING (auth.role() = 'service_role'::text);

-- Admin pode ler via dashboard admin (usa anon key + JWT do admin)
CREATE POLICY "admin_read_kirvano_events" ON public.kirvano_events
  FOR SELECT USING (
    auth.email() = 'migueldrops@gmail.com'::text OR
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ────────────────────────────────────────────────────────────────
-- 2. rate_limits — controle de spam por telefone
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_rate_limits" ON public.rate_limits;

CREATE POLICY "service_role_only_rate_limits" ON public.rate_limits
  FOR ALL USING (auth.role() = 'service_role'::text);

-- ────────────────────────────────────────────────────────────────
-- 3. system_health — health checks automáticos
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_system_health" ON public.system_health;
DROP POLICY IF EXISTS "admin_read_system_health" ON public.system_health;

CREATE POLICY "service_role_only_system_health" ON public.system_health
  FOR ALL USING (auth.role() = 'service_role'::text);

-- Admin pode visualizar
CREATE POLICY "admin_read_system_health" ON public.system_health
  FOR SELECT USING (
    auth.email() = 'migueldrops@gmail.com'::text OR
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ────────────────────────────────────────────────────────────────
-- 4. system_health_log — histórico de health checks
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.system_health_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_system_health_log" ON public.system_health_log;
DROP POLICY IF EXISTS "admin_read_system_health_log" ON public.system_health_log;

CREATE POLICY "service_role_only_system_health_log" ON public.system_health_log
  FOR ALL USING (auth.role() = 'service_role'::text);

CREATE POLICY "admin_read_system_health_log" ON public.system_health_log
  FOR SELECT USING (
    auth.email() = 'migueldrops@gmail.com'::text OR
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );
