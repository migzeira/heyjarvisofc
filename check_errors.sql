-- Últimas sessões atualizadas (para ver se o webhook foi chamado recentemente)
SELECT phone_number, last_activity, last_processed_id
FROM whatsapp_sessions
ORDER BY last_activity DESC;

-- Últimos erros registrados
SELECT context, message, phone_number, created_at
FROM error_logs
ORDER BY created_at DESC
LIMIT 10;

-- Últimas mensagens salvas (para ver se o webhook processou algo novo)
SELECT m.role, m.content, m.created_at, c.phone_number
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
ORDER BY m.created_at DESC
LIMIT 10;
