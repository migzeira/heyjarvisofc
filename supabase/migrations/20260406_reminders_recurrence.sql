-- ==================== REMINDERS: suporte a recorrência ====================

-- Adiciona colunas de recorrência e título à tabela de lembretes existente
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS title       TEXT,
  ADD COLUMN IF NOT EXISTS recurrence  TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_value INTEGER,
  ADD COLUMN IF NOT EXISTS source      TEXT NOT NULL DEFAULT 'event';

-- Índice extra para listagem no dashboard (sem filtro de status)
CREATE INDEX IF NOT EXISTS idx_reminders_user_all
  ON public.reminders(user_id, send_at DESC);

-- Comentários
COMMENT ON COLUMN public.reminders.recurrence IS
  'none | daily | weekly | monthly | day_of_month';
COMMENT ON COLUMN public.reminders.recurrence_value IS
  'Para weekly: dia da semana (0=dom..6=sáb). Para day_of_month: dia (1-31).';
COMMENT ON COLUMN public.reminders.source IS
  'event (lembrete de evento) | whatsapp (criado pelo agente) | manual (criado no dashboard)';
COMMENT ON COLUMN public.reminders.title IS
  'Título curto para exibição no dashboard (max 120 chars)';
