// whatsapp-link-init — Gera código MAYA-XXXXXX e envia pelo WhatsApp do usuário
//
// Fluxo:
//  1. User chama este endpoint autenticado (passa JWT do Supabase Auth)
//  2. Validamos: plano ativo, phone cadastrado, sem LID já vinculado
//  3. Geramos código random de 6 caracteres alfanuméricos
//  4. Salvamos em profiles.link_code + link_code_expires_at (24h)
//  5. Enviamos mensagem via Evolution API pro phone do user
//  6. Retornamos { code, sent: true } pra UI mostrar também
//
// Por que esse fluxo?
//  WhatsApp Multi-Device usa LIDs opacos (@lid) que não contém o número real.
//  O Evolution API retorna 400 quando tenta enviar pra @lid sem resolução.
//  A solução robusta é: enviar PRIMEIRO do nosso lado (usando o phone real
//  que o user cadastrou no app), usuário responde com o código, webhook
//  captura o @lid na resposta e vincula ao profile. Daí pra frente, tudo
//  funciona pelo @lid já salvo.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText } from "../_shared/evolution.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// Gera código random de 6 chars alfanuméricos maiúsculos (sem 0/O/1/I por legibilidade)
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Valida auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "no_auth" }, 401);

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);

  const userId = userData.user.id;

  // Carrega profile
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name, phone_number, account_status, whatsapp_lid, access_until")
    .eq("id", userId)
    .maybeSingle();

  if (profErr || !profile) return json({ error: "profile_not_found" }, 404);

  // Valida plano ativo
  if (profile.account_status !== "active") {
    return json({
      error: "no_active_plan",
      message: "Sua conta precisa de um plano ativo pra vincular o WhatsApp."
    }, 403);
  }

  // Valida phone cadastrado
  const phone = (profile.phone_number ?? "").replace(/\D/g, "");
  if (!phone || phone.length < 10) {
    return json({
      error: "no_phone",
      message: "Você precisa cadastrar seu número de WhatsApp antes."
    }, 400);
  }

  // Gera novo código (sobrescreve qualquer antigo)
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      link_code: code,
      link_code_expires_at: expiresAt,
    } as any)
    .eq("id", userId);

  if (updErr) {
    console.error("[link-init] update error:", updErr);
    return json({ error: "db_error" }, 500);
  }

  // Envia mensagem via Evolution API
  const firstName = (profile.display_name ?? "").split(/\s+/)[0] || "";
  const greeting = firstName ? `Oi ${firstName}! 👋` : "Oi! 👋";
  const msg =
    `${greeting}\n\n` +
    `Pra conectar seu WhatsApp à Maya, envie este código aqui mesmo:\n\n` +
    `*MAYA-${code}*\n\n` +
    `_Esse passo acontece só uma vez. Depois disso é só me mandar mensagens normalmente — registrar gastos, marcar compromissos, criar lembretes, tudo pelo WhatsApp._`;

  let sent = false;
  let sendError: string | null = null;
  try {
    await sendText(phone, msg);
    sent = true;
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error("[link-init] sendText error:", sendError);
  }

  return json({
    ok: true,
    code,
    expires_at: expiresAt,
    sent,
    send_error: sendError,
    already_linked: !!profile.whatsapp_lid,
  });
});
