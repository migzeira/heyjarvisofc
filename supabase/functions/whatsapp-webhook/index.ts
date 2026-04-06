import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText, extractPhone } from "../_shared/evolution.ts";
import {
  extractTransactions,
  extractEvent,
  assistantChat,
  type ChatMessage,
} from "../_shared/openai.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─────────────────────────────────────────────
// INTENT CLASSIFIER (regex first, sem custo IA)
// ─────────────────────────────────────────────
type Intent =
  | "finance_record"
  | "finance_report"
  | "agenda_create"
  | "agenda_query"
  | "notes_save"
  | "reminder_set"
  | "ai_chat";

function classifyIntent(msg: string): Intent {
  const m = msg
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Relatório financeiro (antes de finance_record para evitar falso positivo)
  if (
    /quanto (gastei|ganhei|recebi|devo)|total (de |dos |das )?(gastos?|despesas?)|relatorio|resumo (de |dos )?(gastos?|financ)|meus gastos|minhas despesas/.test(
      m
    )
  )
    return "finance_report";

  // Registro financeiro
  if (
    /gastei|comprei|paguei|recebi|ganhei|custou|vale |custa |despesa|despendi|gasei/.test(
      m
    )
  )
    return "finance_record";

  // Criar agenda
  if (
    /marca(r)?( na| uma| pra)? (agenda|reuniao|meeting|compromisso|consulta|evento)|agendar|marcar reuniao|tenho (reuniao|consulta|compromisso)|colocar na agenda/.test(
      m
    )
  )
    return "agenda_create";

  // Consultar agenda
  if (
    /o que (tenho|tem) (hoje|amanha|essa semana|semana)|minha agenda|(proximos|pr[oó]ximos) (eventos?|compromissos?|reunioes?)|(agenda de|agenda do) (hoje|amanha)/.test(
      m
    )
  )
    return "agenda_query";

  // Salvar nota
  if (
    /^(anota|anotacao|anote|salva|escreve|registra|guarda)[\s:,]|^nota[\s:,]|preciso lembrar|lembrar de /.test(
      m
    )
  )
    return "notes_save";

  // Lembrete simples
  if (/me lembra|me avisa|me notific|lembrete/.test(m)) return "reminder_set";

  return "ai_chat";
}

// ─────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────

async function handleFinanceRecord(
  userId: string,
  phone: string,
  message: string
): Promise<string> {
  const transactions = await extractTransactions(message);

  if (!transactions.length) {
    return "Não consegui identificar os valores. Pode repetir? Ex: *gastei 200 reais de gasolina*";
  }

  const inserts = transactions.map((t) => ({
    user_id: userId,
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: t.category,
    source: "whatsapp",
  }));

  const { error } = await supabase.from("transactions").insert(inserts);
  if (error) throw error;

  if (transactions.length === 1) {
    const t = transactions[0];
    const emoji = t.type === "expense" ? "🔴" : "🟢";
    const verb = t.type === "expense" ? "Gasto" : "Receita";
    return `${emoji} *${verb} registrado!*\n📝 ${t.description}\n💰 R$ ${t.amount.toFixed(2).replace(".", ",")}`;
  }

  const lines = transactions.map((t) => {
    const emoji = t.type === "expense" ? "🔴" : "🟢";
    return `${emoji} ${t.description}: *R$ ${t.amount.toFixed(2).replace(".", ",")}*`;
  });
  const total = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  return (
    `✅ *${transactions.length} registros salvos!*\n\n` +
    lines.join("\n") +
    (total > 0
      ? `\n\n💸 *Total de gastos: R$ ${total.toFixed(2).replace(".", ",")}*`
      : "")
  );
}

async function handleFinanceReport(
  userId: string,
  message: string
): Promise<string> {
  const m = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Determina período
  let startDate: string;
  let periodLabel: string;
  const now = new Date();

  if (/hoje/.test(m)) {
    startDate = now.toISOString().split("T")[0];
    periodLabel = "hoje";
  } else if (/semana/.test(m)) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    startDate = start.toISOString().split("T")[0];
    periodLabel = "esta semana";
  } else if (/mes|mês/.test(m)) {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    periodLabel = "este mês";
  } else {
    // Padrão: mês atual
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    periodLabel = "este mês";
  }

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", startDate)
    .order("transaction_date", { ascending: false });

  if (error) throw error;

  if (!transactions || transactions.length === 0) {
    return `📊 Nenhum registro encontrado para *${periodLabel}*.`;
  }

  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes = transactions.filter((t) => t.type === "income");

  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = incomes.reduce((s, t) => s + Number(t.amount), 0);

  // Agrupa por categoria
  const byCategory: Record<string, number> = {};
  for (const t of expenses) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + Number(t.amount);
  }

  const categoryEmojis: Record<string, string> = {
    alimentacao: "🍔",
    transporte: "🚗",
    moradia: "🏠",
    saude: "💊",
    lazer: "🎮",
    educacao: "📚",
    trabalho: "💼",
    outros: "📦",
  };

  const catLines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, val]) =>
        `${categoryEmojis[cat] ?? "📌"} ${cat}: *R$ ${val.toFixed(2).replace(".", ",")}*`
    )
    .join("\n");

  let report =
    `📊 *Relatório — ${periodLabel}*\n\n` +
    `🔴 Total de gastos: *R$ ${totalExpense.toFixed(2).replace(".", ",")}*\n`;

  if (totalIncome > 0) {
    report += `🟢 Total de receitas: *R$ ${totalIncome.toFixed(2).replace(".", ",")}*\n`;
    const balance = totalIncome - totalExpense;
    const balanceSign = balance >= 0 ? "+" : "";
    report += `💰 Saldo: *${balanceSign}R$ ${balance.toFixed(2).replace(".", ",")}*\n`;
  }

  if (catLines) {
    report += `\n📂 *Por categoria:*\n${catLines}`;
  }

  report += `\n\n📱 Ver gráficos completos no app MayaChat`;

  return report;
}

async function handleAgendaCreate(
  userId: string,
  phone: string,
  message: string,
  session: Record<string, unknown> | null
): Promise<{ response: string; pendingAction?: string; pendingContext?: unknown }> {
  const today = new Date().toISOString().split("T")[0];

  // Verifica se há contexto pendente de follow-up
  const context = (session?.pending_context as Record<string, unknown>) ?? {};
  const combinedMessage =
    Object.keys(context).length > 0
      ? `${JSON.stringify(context)} Resposta do usuário: ${message}`
      : message;

  const extracted = await extractEvent(combinedMessage, today);

  if (extracted.needs_clarification) {
    return {
      response: extracted.needs_clarification,
      pendingAction: "agenda_create",
      pendingContext: { ...context, partial: extracted },
    };
  }

  // Cria o evento
  const eventData: Record<string, unknown> = {
    user_id: userId,
    title: extracted.title,
    event_date: extracted.date,
    event_time: extracted.time,
    source: "whatsapp",
    status: "pending",
  };

  if (extracted.reminder_minutes != null) {
    eventData.reminder = true;
    eventData.reminder_minutes_before = extracted.reminder_minutes;
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert(eventData)
    .select()
    .single();

  if (error) throw error;

  // Cria lembrete se solicitado
  if (extracted.reminder_minutes != null && extracted.time) {
    const [y, mo, d] = extracted.date.split("-").map(Number);
    const [h, min] = extracted.time.split(":").map(Number);
    const eventDateTime = new Date(y, mo - 1, d, h, min);
    const reminderTime = new Date(
      eventDateTime.getTime() - extracted.reminder_minutes * 60 * 1000
    );

    if (reminderTime > new Date()) {
      await supabase.from("reminders").insert({
        user_id: userId,
        event_id: event.id,
        whatsapp_number: phone,
        message: `⏰ *Lembrete!*\nEm ${extracted.reminder_minutes} minutos você tem: *${extracted.title}* às ${extracted.time}`,
        send_at: reminderTime.toISOString(),
      });
    }
  }

  const dateFormatted = new Date(extracted.date + "T12:00:00").toLocaleDateString(
    "pt-BR",
    { weekday: "long", day: "numeric", month: "long" }
  );

  let response = `✅ *Agendado!*\n📅 ${extracted.title}\n🗓 ${dateFormatted}`;
  if (extracted.time) response += `\n⏰ ${extracted.time}`;
  if (extracted.reminder_minutes) {
    response += `\n🔔 Te lembro ${extracted.reminder_minutes} min antes`;
  }

  return { response };
}

async function handleAgendaQuery(userId: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("event_date", today)
    .lte("event_date", nextWeek)
    .eq("status", "pending")
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  if (error) throw error;

  if (!events || events.length === 0) {
    return "📅 Nenhum compromisso nos próximos 7 dias!";
  }

  const lines = events.map((e) => {
    const dateStr = new Date(e.event_date + "T12:00:00").toLocaleDateString(
      "pt-BR",
      { weekday: "short", day: "numeric", month: "short" }
    );
    const time = e.event_time ? ` às ${e.event_time.slice(0, 5)}` : "";
    const reminder = e.reminder ? ` 🔔` : "";
    return `📌 *${e.title}*\n   ${dateStr}${time}${reminder}`;
  });

  return `📅 *Sua agenda (próx. 7 dias):*\n\n${lines.join("\n\n")}`;
}

async function handleNotesSave(
  userId: string,
  message: string
): Promise<string> {
  // Remove prefixos comuns
  let content = message
    .replace(/^(anota|anotacao|anote|salva|escreve|registra|guarda|nota)[\s:,]+/i, "")
    .replace(/^preciso lembrar[\s:,]*/i, "")
    .replace(/^lembrar de[\s:,]*/i, "")
    .trim();

  if (!content) {
    return "O que você quer anotar?";
  }

  const { error } = await supabase.from("notes").insert({
    user_id: userId,
    content,
    source: "whatsapp",
  });

  if (error) throw error;

  return `📝 *Anotado!*\n"${content}"`;
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Apenas mensagens recebidas (não enviadas pelo bot)
  const event = body.event as string;
  if (event !== "messages.upsert") {
    return new Response("OK");
  }

  const data = body.data as Record<string, unknown>;
  const key = data?.key as Record<string, unknown>;
  if (key?.fromMe) {
    return new Response("OK"); // ignora mensagens enviadas pelo bot
  }

  const remoteJid = key?.remoteJid as string;
  if (!remoteJid || remoteJid.endsWith("@g.us")) {
    return new Response("OK"); // ignora grupos
  }

  const phone = extractPhone(remoteJid);
  const messageData = data?.message as Record<string, unknown>;
  const text =
    (messageData?.conversation as string) ||
    (messageData?.extendedTextMessage as Record<string, unknown>)
      ?.text as string;

  if (!text?.trim()) {
    return new Response("OK"); // ignora não-texto (áudio, imagem, etc.)
  }

  // Processa em background para responder rápido
  EdgeRuntime.waitUntil(processMessage(phone, text.trim()));

  return new Response("OK");
});

async function processMessage(phone: string, text: string): Promise<void> {
  try {
    // 1. Busca usuário pelo número de telefone
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, plan, messages_used, messages_limit")
      .eq("phone_number", phone)
      .maybeSingle();

    if (!profile) {
      await sendText(
        phone,
        "❌ Número não encontrado.\nCadastre-se em *mayachat.com.br* e configure seu número no perfil!"
      );
      return;
    }

    // 2. Verifica limite de mensagens
    if (profile.messages_used >= profile.messages_limit) {
      await sendText(
        phone,
        "⚠️ Você atingiu o limite de mensagens do seu plano.\nAcesse o app para fazer upgrade! 🚀"
      );
      return;
    }

    // 3. Carrega configuração do agente
    const { data: config } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();

    const agentName = config?.agent_name ?? "Maya";
    const tone = config?.tone ?? "profissional";

    // 4. Busca/cria sessão (contexto de conversa ativa)
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("phone_number", phone)
      .maybeSingle();

    // 5. Classifica intenção
    let intent: Intent = classifyIntent(text);

    // Se há ação pendente e a mensagem parece ser uma resposta, mantém o contexto
    if (
      session?.pending_action &&
      intent === "ai_chat" &&
      text.length < 100
    ) {
      intent = session.pending_action as Intent;
    }

    // 6. Executa handler
    let responseText: string;
    let pendingAction: string | undefined;
    let pendingContext: unknown;

    if (intent === "finance_record" && config?.module_finance) {
      responseText = await handleFinanceRecord(profile.id, phone, text);
    } else if (intent === "finance_report" && config?.module_finance) {
      responseText = await handleFinanceReport(profile.id, text);
    } else if (intent === "agenda_create" && config?.module_agenda) {
      const result = await handleAgendaCreate(profile.id, phone, text, session);
      responseText = result.response;
      pendingAction = result.pendingAction;
      pendingContext = result.pendingContext;
    } else if (intent === "agenda_query" && config?.module_agenda) {
      responseText = await handleAgendaQuery(profile.id);
    } else if (intent === "notes_save" && config?.module_notes) {
      responseText = await handleNotesSave(profile.id, text);
    } else {
      // Chat geral com IA
      const history = await getRecentHistory(profile.id);
      responseText = await assistantChat(text, agentName, tone, history);
    }

    // 7. Envia resposta
    await sendText(phone, responseText);

    // 8. Atualiza sessão
    await supabase.from("whatsapp_sessions").upsert(
      {
        user_id: profile.id,
        phone_number: phone,
        pending_action: pendingAction ?? null,
        pending_context: pendingContext ?? null,
        last_activity: new Date().toISOString(),
      },
      { onConflict: "phone_number" }
    );

    // 9. Salva mensagens na conversa
    await saveConversation(profile.id, phone, text, responseText, intent);

    // 10. Incrementa contador de mensagens
    await supabase
      .from("profiles")
      .update({ messages_used: profile.messages_used + 1 })
      .eq("id", profile.id);
  } catch (err) {
    console.error("processMessage error:", err);
    try {
      await sendText(
        phone,
        "⚠️ Ocorreu um erro. Tente novamente em alguns instantes."
      );
    } catch {
      // ignora erro no fallback
    }
  }
}

async function getRecentHistory(userId: string): Promise<ChatMessage[]> {
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conv) return [];

  const { data: msgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (msgs ?? []).reverse() as ChatMessage[];
}

async function saveConversation(
  userId: string,
  phone: string,
  userText: string,
  assistantText: string,
  intent: string
): Promise<void> {
  // Busca ou cria conversa ativa
  let { data: conv } = await supabase
    .from("conversations")
    .select("id, message_count")
    .eq("user_id", userId)
    .eq("phone_number", phone)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conv) {
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({ user_id: userId, phone_number: phone })
      .select()
      .single();
    conv = newConv;
  }

  if (!conv) return;

  // Salva mensagens
  await supabase.from("messages").insert([
    {
      conversation_id: conv.id,
      role: "user",
      content: userText,
      intent,
    },
    {
      conversation_id: conv.id,
      role: "assistant",
      content: assistantText,
    },
  ]);

  // Atualiza contadores
  await supabase
    .from("conversations")
    .update({
      message_count: (conv.message_count ?? 0) + 2,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conv.id);
}

// Suporte a EdgeRuntime para Deno Deploy / Supabase
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };
