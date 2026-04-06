

## Análise do Painel Admin — Problemas e Melhorias

### Problemas Atuais

1. **Dados incompletos nos stats**: `pendingUsers` sempre mostra 0 porque `account_status` não é buscado no `loadProfiles` (linha 62 não inclui `account_status` no select)
2. **Sem paginação**: Todas as tabelas carregam um limite fixo (100-200) sem paginação real — impossível navegar histórico
3. **Sem email na tabela de usuários**: A tabela `profiles` não tem coluna `email`, então não dá para buscar por email nem exibir
4. **Sem refresh automático**: Dados ficam estáticos até recarregar a página inteira
5. **Sem exportação de dados**: Nenhuma forma de exportar CSV para análise externa
6. **Sem logs de erro**: A tabela `error_logs` existe mas não aparece no admin
7. **Sem dados de pagamento**: A tabela `kirvano_payments` existe mas não é exibida
8. **Sem métricas temporais**: Não há gráficos de evolução (usuários/dia, mensagens/semana)
9. **Sem ação de alterar plano**: Admin não consegue mudar o plano de um usuário
10. **Sem filtro por data**: Nenhuma tabela permite filtrar por período

### Plano de Implementação

#### 1. Corrigir bugs existentes
- Adicionar `account_status` ao select de profiles
- Corrigir contagem de pendentes que sempre retorna 0

#### 2. Nova aba: Pagamentos (Kirvano)
- Buscar da tabela `kirvano_payments` com colunas: email, nome, plano, valor, status, data
- Badge colorido por status (approved/pending/refunded)
- Stats card: receita total, pagamentos aprovados, ticket médio

#### 3. Nova aba: Logs de Erro
- Buscar da tabela `error_logs` com colunas: data, contexto, mensagem, telefone, stack (expansível)
- Filtro por contexto (whatsapp-webhook, process-recurring, etc.)
- Badge de severidade

#### 4. Gráficos de métricas (mini dashboard)
- Adicionar na área de stats: mini gráfico sparkline de novos usuários nos últimos 7 dias
- Card com "Mensagens hoje" vs "ontem" com seta de tendência
- Usar dados já disponíveis, sem lib externa — barras CSS simples

#### 5. Ações administrativas no usuário
- Dropdown no botão "Ver" com opções: Ver detalhes, Alterar plano, Suspender/Ativar conta
- No modal do usuário, adicionar botão "Alterar plano" com select (starter/pro/business)
- Botão "Suspender conta" / "Reativar conta"

#### 6. Paginação nas tabelas
- Adicionar paginação simples (anterior/próximo) em todas as tabelas
- 25 itens por página
- Usar offset no Supabase `.range(from, to)`

#### 7. Filtros por data
- Adicionar seletor de período (Hoje, 7 dias, 30 dias, Tudo) nas abas de Mensagens, Transações, Conversas
- Filtrar no Supabase com `.gte('created_at', startDate)`

#### 8. Botão de refresh e auto-refresh
- Botão "Atualizar" no header
- Indicador de "última atualização há X min"

#### 9. Exportar CSV
- Botão "Exportar CSV" em cada aba que gera download dos dados filtrados

#### 10. Melhorias no UserDetailModal
- Adicionar aba "Eventos/Agenda" (buscar da tabela `events`)
- Adicionar aba "Lembretes" (buscar da tabela `reminders`)
- Adicionar aba "Notas" (buscar da tabela `notes`)
- Mostrar resumo no topo: total de msgs, total de transações, dias desde cadastro, último acesso

### Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/AdminPanel.tsx` | Corrigir bugs, adicionar abas Pagamentos e Logs, paginação, filtros, gráficos, export CSV, refresh |
| `src/pages/admin/UserDetailModal.tsx` | Adicionar abas Eventos/Lembretes/Notas, ações de alterar plano/suspender, resumo no topo |

### Detalhes técnicos

- Nenhuma migração SQL necessária — todas as tabelas e RLS já existem
- Queries usam o client autenticado com as policies de admin já configuradas
- Export CSV via `Blob` + `URL.createObjectURL` no browser
- Gráficos com barras CSS (`div` com height dinâmico), sem dependência externa
- Paginação com state local `page` + `.range(page*25, (page+1)*25 - 1)`

