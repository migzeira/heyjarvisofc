-- Tabela de relay de mensagens entre contatos
-- Quando Jarvis envia mensagem pra um contato em nome do usuario,
-- registra aqui para que a resposta do contato seja repassada automaticamente.

CREATE TABLE IF NOT EXISTS relay_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_phone TEXT NOT NULL,         -- telefone do usuario Jarvis (quem pediu o envio)
  to_phone TEXT NOT NULL,           -- telefone do contato que recebeu a mensagem
  original_message TEXT NOT NULL,   -- conteudo da mensagem enviada
  status TEXT NOT NULL DEFAULT 'sent',  -- sent | completed | expired
  session_step TEXT DEFAULT NULL,   -- null=aguardando | 'waiting_reply'=coletando resposta
  relay_reply TEXT DEFAULT NULL,    -- resposta recebida do contato
  sender_name TEXT DEFAULT NULL,    -- nome do usuario para usar nas mensagens ao contato
  agent_name TEXT DEFAULT NULL,     -- nome do agente (ex: Jarvis)
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice principal: busca por telefone do contato + status + nao expirado
CREATE INDEX IF NOT EXISTS relay_requests_to_phone_idx
  ON relay_requests(to_phone, status, expires_at);

-- Indice para limpeza de expirados
CREATE INDEX IF NOT EXISTS relay_requests_expires_at_idx
  ON relay_requests(expires_at);
