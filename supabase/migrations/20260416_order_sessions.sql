-- Sessoes de pedido ativo
-- Quando Jarvis faz um pedido em nome do usuario, cria uma sessao de 1h.
-- Durante esse tempo, TODAS as mensagens do estabelecimento sao interceptadas:
--   - Jarvis tenta responder automaticamente (preco, forma de pagamento, tempo)
--   - Se nao souber, repassa ao usuario imediatamente

CREATE TABLE IF NOT EXISTS order_sessions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_phone          TEXT NOT NULL,           -- telefone do usuario Jarvis (quem fez o pedido)
  business_phone      TEXT NOT NULL,           -- telefone do estabelecimento
  business_name       TEXT NOT NULL,           -- nome do estabelecimento (ex: Pizzaria Kadalora)
  order_summary       TEXT NOT NULL,           -- resumo do pedido (ex: "1x calabresa, 1x 4 queijos")
  delivery_address    TEXT DEFAULT NULL,       -- endereco de entrega usado no pedido
  payment_preference  TEXT DEFAULT 'debito',   -- forma de pagamento informada ao estabelecimento
  status              TEXT NOT NULL DEFAULT 'active', -- active | completed | expired
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Busca por telefone do estabelecimento + sessao ativa + nao expirada
CREATE INDEX IF NOT EXISTS order_sessions_business_phone_idx
  ON order_sessions(business_phone, status, expires_at);

-- Busca por usuario para listar pedidos ativos
CREATE INDEX IF NOT EXISTS order_sessions_user_id_idx
  ON order_sessions(user_id, status);

-- Limpeza de sessoes expiradas
CREATE INDEX IF NOT EXISTS order_sessions_expires_at_idx
  ON order_sessions(expires_at);
