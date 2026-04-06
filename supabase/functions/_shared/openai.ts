const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Chamada simples ao GPT-4o-mini para extração de dados ou chat */
export async function chat(
  messages: ChatMessage[],
  jsonMode = false
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
      max_tokens: 500,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content as string;
}

/** Extrai dados estruturados de transações financeiras do texto do usuário */
export async function extractTransactions(
  text: string
): Promise<Array<{ amount: number; description: string; type: "expense" | "income"; category: string }>> {
  const prompt = `Extraia transações financeiras do texto abaixo. Retorne JSON com array "transactions".
Cada item: { "amount": número, "description": string, "type": "expense" ou "income", "category": uma de [alimentacao, transporte, moradia, saude, lazer, educacao, trabalho, outros] }

Texto: "${text}"

Exemplos:
"gastei 200 de gasolina" → expense, transporte
"paguei 500 no mercado" → expense, alimentacao
"recebi 1000 de freela" → income, trabalho
"comprei remédio 80 reais" → expense, saude`;

  const result = await chat(
    [{ role: "user", content: prompt }],
    true
  );
  const parsed = JSON.parse(result);
  return parsed.transactions ?? [];
}

/** Extrai dados de evento/agenda do texto do usuário */
export async function extractEvent(
  text: string,
  today: string
): Promise<{
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  reminder_minutes: number | null;
  needs_clarification: string | null;
}> {
  const prompt = `Extraia informações de evento/agenda do texto. Hoje é ${today}. Retorne JSON.
Campos: { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM" ou null, "reminder_minutes": número ou null, "needs_clarification": string ou null }

Se faltar título, coloque "needs_clarification": "Qual o nome ou motivo desse compromisso?"
Se faltar horário, coloque "needs_clarification": "A que horas é? Quer que eu te lembre antes?"
Se tiver lembrete explícito, preencha reminder_minutes (ex: "20 minutos antes" = 20).

Texto: "${text}"`;

  const result = await chat(
    [{ role: "user", content: prompt }],
    true
  );
  return JSON.parse(result);
}

/** Chat geral com o assistente Maya */
export async function assistantChat(
  userMessage: string,
  agentName: string,
  tone: string,
  history: ChatMessage[]
): Promise<string> {
  const systemPrompt = `Você é ${agentName}, assistente pessoal inteligente via WhatsApp.
Tom: ${tone}. Idioma: Português brasileiro.
Você ajuda com finanças, agenda, anotações e conversas gerais.
Seja conciso e natural. Não mencione que é IA a menos que perguntado.
Não invente dados. Se não souber algo, diga que não sabe.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6), // últimas 6 mensagens de contexto
    { role: "user", content: userMessage },
  ];

  return await chat(messages);
}
