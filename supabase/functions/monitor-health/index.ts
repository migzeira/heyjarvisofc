/**
 * monitor-health
 * Roda a cada 5 minutos via pg_cron.
 * Verifica se a instância da Evolution API está conectada ao WhatsApp.
 * Armazena o resultado em system_health para o painel admin consultar.
 * Se detectar queda após X checks, insere um alerta crítico em error_logs.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const EVOLUTION_URL  = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_KEY  = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const INSTANCE       = Deno.env.get("EVOLUTION_INSTANCE_NAME") ?? "mayachat";
const CRON_SECRET    = Deno.env.get("CRON_SECRET") ?? "";

// Alerta crítico após 3 falhas consecutivas (= 15 min offline)
const ALERT_THRESHOLD = 3;

serve(async (req) => {
  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date().toISOString();
  let isOnline = false;
  let statusDetail = "";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_KEY },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      const state = (data?.instance as Record<string, unknown>)?.state ?? data?.state ?? "";
      isOnline = state === "open";
      statusDetail = String(state);
    } else {
      statusDetail = `HTTP ${res.status}`;
    }
  } catch (err) {
    statusDetail = err instanceof Error ? err.message : "timeout";
  }

  // Salva o status atual
  await supabase.from("system_health").upsert({
    service: "evolution_api",
    is_online: isOnline,
    status_detail: statusDetail,
    checked_at: now,
  }, { onConflict: "service" });

  // Conta falhas consecutivas recentes (últimas 15 min)
  if (!isOnline) {
    const since15min = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("system_health_log")
      .select("id", { count: "exact", head: true })
      .eq("service", "evolution_api")
      .eq("is_online", false)
      .gte("checked_at", since15min) as any;

    const consecutiveFails = (count ?? 0) + 1; // +1 para incluir a atual

    // Insere log
    await supabase.from("system_health_log").insert({
      service: "evolution_api",
      is_online: false,
      status_detail: statusDetail,
      checked_at: now,
    });

    if (consecutiveFails >= ALERT_THRESHOLD) {
      // Verifica se já existe alerta não resolvido nas últimas 2h para não spammar
      const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("error_logs")
        .select("id")
        .eq("context", "monitor-health/evolution-down")
        .gte("created_at", since2h)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        await supabase.from("error_logs").insert({
          context: "monitor-health/evolution-down",
          message: `Evolution API offline há ${consecutiveFails * 5} minutos. Estado: ${statusDetail}`,
          severity: "critical",
          metadata: { consecutiveFails, statusDetail, instance: INSTANCE },
        });
        console.error(`[monitor-health] 🚨 CRITICAL: Evolution API offline for ${consecutiveFails * 5} min!`);
      }
    } else {
      // Insere no log mesmo sem atingir threshold
      console.warn(`[monitor-health] ⚠️ Evolution API offline (${consecutiveFails} check(s)): ${statusDetail}`);
    }
  } else {
    // Online — insere no log
    await supabase.from("system_health_log").insert({
      service: "evolution_api",
      is_online: true,
      status_detail: statusDetail,
      checked_at: now,
    });
    console.log(`[monitor-health] ✅ Evolution API online: ${statusDetail}`);
  }

  return new Response(JSON.stringify({ isOnline, statusDetail, checked_at: now }), {
    headers: { "Content-Type": "application/json" },
  });
});
