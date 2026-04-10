-- Pending WhatsApp Links — tabela para vinculação sem atrito
--
-- Quando o cliente cadastra o phone no MeuPerfil, gravamos aqui uma janela
-- de 15 minutos dizendo "esperamos a resposta desse user". Quando o webhook
-- recebe uma mensagem de LID/phone desconhecido, procura um pending_link
-- ativo e ÚNICO — se achar, vincula automaticamente.
--
-- Isso permite que o cliente apenas responda "oi" no WhatsApp, sem precisar
-- copiar/enviar o código MAYA-XXXXXX manualmente.

CREATE TABLE IF NOT EXISTS public.pending_whatsapp_links (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number   TEXT NOT NULL,
  push_name_hint TEXT, -- dica opcional pra desambiguar quando há múltiplos pending
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_links_expires ON public.pending_whatsapp_links(expires_at);

-- RLS: só o próprio user pode ver/modificar seu pending link
ALTER TABLE public.pending_whatsapp_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_pending_link" ON public.pending_whatsapp_links;
CREATE POLICY "users_own_pending_link" ON public.pending_whatsapp_links
  FOR ALL USING (auth.uid() = user_id);

-- pg_cron: limpa pending links expirados a cada hora (minuto 7)
DO $$
BEGIN
  PERFORM cron.unschedule('maya-cleanup-pending-links');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'maya-cleanup-pending-links',
  '7 * * * *',
  $$ DELETE FROM public.pending_whatsapp_links WHERE expires_at < NOW(); $$
);
