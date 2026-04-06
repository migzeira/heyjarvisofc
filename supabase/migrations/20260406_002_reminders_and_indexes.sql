-- ==================== REMINDERS ====================
-- Tabela para lembretes agendados (disparados pelo pg_cron)
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  message TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reminders" ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reminders" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON public.reminders FOR DELETE USING (auth.uid() = user_id);
-- Service role pode atualizar status (Edge Function usa service role)
CREATE POLICY "Service role can update reminders" ON public.reminders FOR UPDATE USING (true);

CREATE INDEX idx_reminders_send_at ON public.reminders(send_at) WHERE status = 'pending';
CREATE INDEX idx_reminders_user ON public.reminders(user_id, send_at);

-- ==================== PHONE NUMBER INDEX ====================
-- Índice para lookup rápido de usuário por telefone (multi-tenant WhatsApp)
CREATE INDEX idx_profiles_phone_number ON public.profiles(phone_number) WHERE phone_number IS NOT NULL;

-- ==================== WHATSAPP SESSIONS ====================
-- Contexto de conversa ativa para manter estado entre mensagens
CREATE TABLE public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  pending_action TEXT, -- agenda_create | finance_record | etc. (aguardando follow-up)
  pending_context JSONB, -- dados parciais da ação pendente
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.whatsapp_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages sessions" ON public.whatsapp_sessions FOR ALL USING (true);

CREATE INDEX idx_sessions_phone ON public.whatsapp_sessions(phone_number);
CREATE INDEX idx_sessions_user ON public.whatsapp_sessions(user_id);

-- ==================== KIRVANO PAYMENTS ====================
CREATE TABLE public.kirvano_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kirvano_order_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES public.profiles(id),
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL, -- approved | canceled | refunded | chargeback
  amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kirvano_email ON public.kirvano_payments(email);
CREATE INDEX idx_kirvano_order ON public.kirvano_payments(kirvano_order_id);
