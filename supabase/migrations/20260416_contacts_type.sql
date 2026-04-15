-- Adiciona tipo e categoria aos contatos
-- type: 'person' (padrão) | 'business' (estabelecimento)
-- category: 'pizzaria' | 'restaurante' | 'farmacia' | 'mercado' | 'servico' | etc.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'person';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- Indice para buscar estabelecimentos de um usuario rapidamente
CREATE INDEX IF NOT EXISTS contacts_user_type_idx ON contacts(user_id, type);
