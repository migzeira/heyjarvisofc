-- Adiciona coluna order_context para armazenar dados de pedidos agendados
-- Usado por reminders com source='scheduled_order' para o send-reminder
-- poder criar a order_session e enviar a mensagem ao estabelecimento
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS order_context JSONB DEFAULT NULL;
