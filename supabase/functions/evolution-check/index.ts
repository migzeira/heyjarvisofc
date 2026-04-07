/**
 * evolution-check — diagnóstico da Evolution API
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Exige autenticação de admin via Supabase Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== "migueldrops@gmail.com") {
    return new Response("Unauthorized", { status: 401 });
  }

  const url      = Deno.env.get("EVOLUTION_API_URL") ?? "";
  const key      = Deno.env.get("EVOLUTION_API_KEY") ?? "";
  const instance = Deno.env.get("EVOLUTION_INSTANCE_NAME") ?? "mayachat";

  const report: Record<string, unknown> = {
    evolution_url: url || "❌ EVOLUTION_API_URL não configurado",
    instance_name: instance,
    key_configured: !!key,
  };

  if (!url) {
    return new Response(JSON.stringify(report, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Estado de conexão da instância
  try {
    const r = await fetch(`${url}/instance/connectionState/${instance}`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(8000),
    });
    report.connection_http = r.status;
    report.connection_state = await r.json().catch(() => null);
  } catch (e) {
    report.connection_error = `Não conseguiu alcançar ${url} — ${String(e)}`;
  }

  // 2. Lista instâncias disponíveis
  try {
    const r = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(8000),
    });
    const list = await r.json().catch(() => []);
    report.all_instances = Array.isArray(list)
      ? list.map((i: Record<string, unknown>) => ({
          name: (i.instance as Record<string,unknown>)?.instanceName ?? i.name,
          state: (i.instance as Record<string,unknown>)?.state ?? i.state,
        }))
      : list;
  } catch (e) {
    report.instances_error = String(e);
  }

  return new Response(JSON.stringify(report, null, 2), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
