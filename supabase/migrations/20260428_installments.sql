-- Parcelamento de compras: 3 colunas opcionais em transactions.
--
-- "comprei celular 300 em 3x" → 3 transações de R$100 com:
--   installment_group: UUID que agrupa as 3 parcelas
--   installment_number: 1, 2, 3
--   installment_total: 3
--
-- Transações normais (sem parcelamento) ficam com NULL nesses campos.
-- Nullable = zero impacto em queries/relatórios existentes.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS installment_group UUID,
  ADD COLUMN IF NOT EXISTS installment_number INTEGER,
  ADD COLUMN IF NOT EXISTS installment_total INTEGER;

-- Index parcial pra queries de parcelas (só indexa quando tem grupo)
CREATE INDEX IF NOT EXISTS idx_transactions_installment_group
  ON public.transactions(installment_group) WHERE installment_group IS NOT NULL;
