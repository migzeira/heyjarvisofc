-- CRÍTICO: Fix RLS bloqueando INSERT de gastos via webhook
--
-- PROBLEMA: transactions table tem RLS com policies que só permitem auth.uid() = user_id
-- Quando webhook usa service_role (não tem JWT), auth.uid() é NULL, então a policy
-- WITH CHECK (auth.uid() = user_id) vira WITH CHECK (NULL = user_id) = sempre falsa.
-- Por isso INSERT de gastos via whatsapp falha silenciosamente.
--
-- SOLUÇÃO: Adicionar policy que permite service_role fazer INSERT/SELECT/UPDATE/DELETE
-- Usuários normais ainda usam suas policies (só veem/editam próprias transações)

DROP POLICY IF EXISTS "service_role_only_transactions" ON public.transactions;

CREATE POLICY "service_role_only_transactions" ON public.transactions
  FOR ALL USING (auth.role() = 'service_role'::text);
