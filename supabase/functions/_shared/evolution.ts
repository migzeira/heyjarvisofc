const EVOLUTION_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const INSTANCE = Deno.env.get("EVOLUTION_INSTANCE_NAME") ?? "mayachat";

/** Envia mensagem de texto via Evolution API */
export async function sendText(to: string, text: string): Promise<void> {
  const number = normalizePhone(to);
  await evolutionPost(`/message/sendText/${INSTANCE}`, { number, text });
}

/** Envia imagem via Evolution API (base64 ou URL) */
export async function sendImage(
  to: string,
  media: string,
  caption: string,
  isUrl = false
): Promise<void> {
  const number = normalizePhone(to);
  const body = isUrl
    ? { number, mediatype: "image", mimetype: "image/png", caption, media }
    : { number, mediatype: "image", mimetype: "image/png", caption, media };
  await evolutionPost(`/message/sendMedia/${INSTANCE}`, body);
}

/** Extrai número de telefone limpo do remoteJid do WhatsApp */
export function extractPhone(remoteJid: string): string {
  return remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
}

/** Normaliza número para formato Evolution API */
function normalizePhone(phone: string): string {
  let n = phone.replace(/\D/g, "");
  if (!n.startsWith("55")) n = `55${n}`;
  return n;
}

async function evolutionPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evolution API error ${res.status}: ${err}`);
  }
  return res.json();
}
