-- Plan gating + Kirvano auto-link
-- 1) Remove auto-ativação pelo trigger de phone change
--    (antes: setar phone = active; agora: status só vem via admin ou Kirvano)
-- 2) handle_new_user agora consulta kirvano_events por email e auto-ativa
--    contas que já tem compra Kirvano registrada antes do signup.

-- ────────────────────────────────────────────────────────────────
-- (1) Phone trigger: só reverte pra pending ao limpar o número.
--     Setar/trocar número NÃO promove mais para active.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_account_status_on_phone_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Phone was cleared → revert to pending so next save re-activates via admin/Kirvano
  IF NEW.phone_number IS NULL AND OLD.phone_number IS NOT NULL THEN
    NEW.account_status = 'pending';
  END IF;

  -- REMOVIDO: auto-ativar quando setar telefone.
  -- account_status = 'active' só via admin (UserDetailModal) ou webhook Kirvano.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ────────────────────────────────────────────────────────────────
-- (2) handle_new_user: consulta kirvano_events por email e auto-ativa
--     se houver compra Kirvano pendente (sem matched_user_id ainda).
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
BEGIN
  v_email := LOWER(COALESCE(NEW.email, ''));

  -- Busca último evento Kirvano 'activate' não matcheado para este email
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
      -- Detecta plano anual vs mensal pelo nome do produto
      IF LOWER(COALESCE(v_kirvano.product_name, '')) ~ '(anual|annual|annually)' THEN
        v_plan := 'maya_anual';
      ELSE
        v_plan := 'maya_mensal';
      END IF;
      v_sub_id := v_kirvano.subscription_id;

      -- Marca o evento como matcheado para esta conta
      UPDATE public.kirvano_events
      SET matched_user_id = NEW.id
      WHERE id = v_kirvano.id;
    END IF;
  END IF;

  -- Cria profile com status/plano derivados
  INSERT INTO public.profiles (id, display_name, plan, account_status, kirvano_subscription_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_plan,
    v_status,
    v_sub_id
  );

  -- Agent config: só fica ativo se o plano já estiver ativo (via Kirvano)
  INSERT INTO public.agent_configs (user_id, is_active) VALUES (NEW.id, v_agent_active);

  -- Create default categories
  INSERT INTO public.categories (user_id, name, icon, is_default) VALUES
    (NEW.id, 'Alimentação', '🍔', true),
    (NEW.id, 'Transporte', '🚗', true),
    (NEW.id, 'Moradia', '🏠', true),
    (NEW.id, 'Saúde', '💊', true),
    (NEW.id, 'Lazer', '🎮', true),
    (NEW.id, 'Educação', '📚', true),
    (NEW.id, 'Trabalho', '💼', true),
    (NEW.id, 'Outros', '📦', true);

  -- Create default integrations
  INSERT INTO public.integrations (user_id, provider) VALUES
    (NEW.id, 'google_calendar'),
    (NEW.id, 'notion'),
    (NEW.id, 'google_sheets');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ────────────────────────────────────────────────────────────────
-- (3) Backfill: contas 'active' sem plano conhecido que foram ativadas
--     via trigger antigo (phone change) NÃO são tocadas — admin pode
--     gerenciar manualmente. Aqui só garantimos que novas contas sem
--     Kirvano match nasçam como 'pending'.
-- ────────────────────────────────────────────────────────────────
