-- Dados de entrega do usuario (usados pelo Jarvis ao fazer pedidos)
-- Campos adicionados ao perfil existente — nao altera nenhuma coluna existente

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_street      TEXT DEFAULT NULL; -- Rua/Avenida
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_number      TEXT DEFAULT NULL; -- Numero
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_complement  TEXT DEFAULT NULL; -- Apto, Bloco, etc.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_neighborhood TEXT DEFAULT NULL; -- Bairro
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_city        TEXT DEFAULT NULL; -- Cidade
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS delivery_reference   TEXT DEFAULT NULL; -- "Portao azul", "Proximo ao mercado"
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_preference   TEXT DEFAULT 'debito'; -- debito | credito | pix | dinheiro
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf_orders           TEXT DEFAULT NULL; -- CPF para nota fiscal
