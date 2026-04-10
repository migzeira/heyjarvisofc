-- Access source + subscription tracking + auto-expire cron
--
-- 1) access_source: distingue origem da ativação (kirvano | admin_plan | admin_trial)
--    → UI mostra banners/labels diferentes para cada caso
-- 2) subscription_cancelled_at: timestamp de quando Kirvano enviou cancel
--    → UI só mostra "Assinatura cancelada" quando esse campo tem valor
-- 3) pg_cron: desativa automaticamente contas expiradas a cada hora
--    → access_until no passado vira account_status='pending' + agent paused

-- ────────────────────────────────────────────────────────────────
-- (1) Novas colunas em profiles
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_source TEXT,
  ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.access_source IS
  'Origem da ativação: kirvano | admin_plan | admin_trial. NULL = sem plano.';
COMMENT ON COLUMN public.profiles.subscription_cancelled_at IS
  'Timestamp de quando o webhook Kirvano enviou cancel. NULL = não cancelado.';

-- ────────────────────────────────────────────────────────────────
-- (2) handle_new_user: agora seta access_source='kirvano' quando matcheia
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_kirvano RECORD;
  v_plan TEXT := 'maya_mensal';
  v_status TEXT := 'pending';
  v_sub_id TEXT := NULL;
  v_agent_active BOOLEAN := false;
  v_access_source TEXT := NULL;
BEGIN
  v_email := LOWER(COALESCE(NEW.email, ''));

  IF v_email <> '' THEN
    SELECT * INTO v_kirvano
    FROM public.kirvano_events
    WHERE LOWER(COALESCE(customer_email, '')) = v_email
      AND status = 'activate'
      AND matched_user_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_status := 'active';
      v_agent_active := true;
      v_access_source := 'kirvano';
      IF LOWER(COALESCE(v_kirvano.product_name, '')) ~ '(anual|annual|annually)' THEN
        v_plan := 'maya_anual';
      ELSE
        v_plan := 'maya_mensal';
      END IF;
      v_sub_id := v_kirvano.subscription_id;

      UPDATE public.kirvano_events
      SET matched_user_id = NEW.id
      WHERE id = v_kirvano.id;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, plan, account_status, kirvano_subscription_id, access_source)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_plan,
    v_status,
    v_sub_id,
    v_access_source
  );

  INSERT INTO public.agent_configs (user_id, is_active) VALUES (NEW.id, v_agent_active);

  INSERT INTO public.categories (user_id, name, icon, is_default) VALUES
    (NEW.id, 'Alimentação', '🍔', true),
    (NEW.id, 'Transporte', '🚗', true),
    (NEW.id, 'Moradia', '🏠', true),
    (NEW.id, 'Saúde', '💊', true),
    (NEW.id, 'Lazer', '🎮', true),
    (NEW.id, 'Educação', '📚', true),
    (NEW.id, 'Trabalho', '💼', true),
    (NEW.id, 'Outros', '📦', true);

  INSERT INTO public.integrations (user_id, provider) VALUES
    (NEW.id, 'google_calendar'),
    (NEW.id, 'notion'),
    (NEW.id, 'google_sheets');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ────────────────────────────────────────────────────────────────
-- (3) Função de auto-expire — revoga acesso de contas com
--     access_until no passado. Volta pra 'pending' (sem plano).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_stale_accounts()
RETURNS void AS $$
DECLARE
  v_count INT := 0;
BEGIN
  -- 1. Profiles ativos com access_until no passado → volta pra pending
  WITH expired AS (
    UPDATE public.profiles
    SET
      account_status = 'pending',
      access_until = NULL,
      access_source = NULL,
      subscription_cancelled_at = NULL
    WHERE account_status = 'active'
      AND access_until IS NOT NULL
      AND access_until < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  -- 2. Pausa agentes desses usuários que foram expirados agora
  IF v_count > 0 THEN
    UPDATE public.agent_configs ac
    SET is_active = false
    FROM public.profiles p
    WHERE p.id = ac.user_id
      AND p.account_status = 'pending'
      AND ac.is_active = true
      AND p.updated_at > NOW() - INTERVAL '5 minutes'; -- só os recém-expirados
  END IF;

  RAISE NOTICE 'expire_stale_accounts: % accounts expired', v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ────────────────────────────────────────────────────────────────
-- (4) pg_cron: agenda expire_stale_accounts a cada hora
-- ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove job antigo se existir
DO $$
BEGIN
  PERFORM cron.unschedule('maya-auto-expire-accounts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda novo job: todo quarto minuto de cada hora (para não concentrar no :00)
SELECT cron.schedule(
  'maya-auto-expire-accounts',
  '4 * * * *',
  $$ SELECT public.expire_stale_accounts(); $$
);
