/**
 * weekly-briefing
 * Chamado pelo pg_cron aos domingos às 23:00 UTC (20:00 BRT).
 * Envia um resumo da agenda + lembretes da semana seguinte para cada usuário ativo.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText } from "../_shared/evolution.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const EVENT_TYPE_EMOJIS: Record<string, string> = {
  compromisso: "📌",
  reuniao: "🤝",
  consulta: "🏥",
  evento: "🎉",
  tarefa: "✏️",
};

const WEEKDAY_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Retorna a data de hoje (YYYY-MM-DD) no fuso do usuário */
function todayInTz(tz: string): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: tz });
}

/** Calcula startDate (próxima segunda) e endDate (próximo domingo) para um dado fuso */
function nextWeekRange(tz: string): { startDate: string; endDate: string; nextMonday: Date; nextSunday: Date } {
  const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  const daysUntilMonday = ((8 - nowLocal.getDay()) % 7) || 7;

  const nextMonday = new Date(nowLocal);
  nextMonday.setDate(nowLocal.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  const startDate = nextMonday.toLocaleDateString("sv-SE");
  const endDate = nextSunday.toLocaleDateString("sv-SE");

  return { startDate, endDate, nextMonday, nextSunday };
}

serve(async (req) => {
  // Auth via CRON_SECRET
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  console.log(`[weekly-briefing] Running at UTC: ${new Date().toISOString()}`);

  // Busca usuários ativos com número configurado
  const { data: users, error: usersErr } = await supabase
    .from("profiles")
    .select("id, phone_number, timezone")
    .eq("account_status", "active")
    .not("phone_number", "is", null);

  if (usersErr) {
    console.error("Error fetching users:", usersErr);
    return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users ?? []) {
    if (!user.phone_number) { skipped++; continue; }

    try {
      // Busca configurações do agente
      const { data: cfg } = await supabase
        .from("agent_configs")
        .select("user_nickname, daily_briefing_enabled, language")
        .eq("user_id", user.id)
        .maybeSingle();

      // Respeita o toggle
      if (cfg?.daily_briefing_enabled === false) { skipped++; continue; }

      const userTz = (user.timezone as string) || "America/Sao_Paulo";
      const userLang = (cfg?.language as string) || "pt-BR";
      const userName = (cfg?.user_nickname as string) || "você";
      const locale = userLang === "en" ? "en-US" : userLang === "es" ? "es-ES" : "pt-BR";

      const { startDate, endDate, nextMonday, nextSunday } = nextWeekRange(userTz);

      // Busca eventos da próxima semana no fuso do usuário
      const { data: events } = await supabase
        .from("events")
        .select("title, event_date, event_time, end_time, event_type, location, status")
        .eq("user_id", user.id)
        .gte("event_date", startDate)
        .lte("event_date", endDate)
        .neq("status", "cancelled")
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      // Busca lembretes pendentes da próxima semana
      const weekStartIso = new Date(`${startDate}T00:00:00Z`).toISOString();
      const weekEndIso   = new Date(`${endDate}T23:59:59Z`).toISOString();
      const { data: reminders } = await supabase
        .from("reminders")
        .select("title, send_at, message, recurrence")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .gte("send_at", weekStartIso)
        .lte("send_at", weekEndIso)
        .order("send_at", { ascending: true });

      const mondayFormatted = nextMonday.toLocaleDateString(locale, { day: "numeric", month: "long" });
      const sundayFormatted = nextSunday.toLocaleDateString(locale, { day: "numeric", month: "long" });

      const hasEvents    = events    && events.length    > 0;
      const hasReminders = reminders && reminders.length > 0;

      let message: string;

      if (!hasEvents && !hasReminders) {
        if (userLang === "en") {
          message = `📅 *Hi, ${userName}!*\n\nYour week from *${mondayFormatted} to ${sundayFormatted}* is wide open!\n\nWant me to add appointments, set reminders, or organize your schedule? Just let me know. 😊`;
        } else if (userLang === "es") {
          message = `📅 *¡Hola, ${userName}!*\n\nTu semana del *${mondayFormatted} al ${sundayFormatted}* está completamente libre!\n\nSi quieres, puedo anotar compromisos, crear recordatorios u organizar tu agenda. ¡Solo dímelo! 😊`;
        } else {
          message = `📅 *Olá, ${userName}!*\n\nSua semana de *${mondayFormatted} a ${sundayFormatted}* está livre!\n\nSe quiser, posso anotar compromissos, criar lembretes ou organizar sua agenda. É só me dizer. 😊`;
        }
      } else {
        const totalItems = (events?.length ?? 0) + (hasReminders ? 1 : 0);

        const lines: string[] = [];

        if (userLang === "en") {
          lines.push(`📅 *Your week — ${mondayFormatted} to ${sundayFormatted}*`);
        } else if (userLang === "es") {
          lines.push(`📅 *Tu semana — ${mondayFormatted} al ${sundayFormatted}*`);
        } else {
          lines.push(`📅 *Sua semana — ${mondayFormatted} a ${sundayFormatted}*`);
        }

        const itemCount = (events?.length ?? 0) + (reminders?.length ?? 0);
        if (userLang === "en") {
          lines.push(`_(${itemCount} item${itemCount > 1 ? "s" : ""})_\n`);
        } else if (userLang === "es") {
          lines.push(`_(${itemCount} elemento${itemCount > 1 ? "s" : ""})_\n`);
        } else {
          lines.push(`_(${itemCount} item${itemCount > 1 ? "s" : ""})_\n`);
        }

        // Agrupa eventos por data
        if (hasEvents) {
          const grouped: Record<string, typeof events> = {};
          for (const ev of events!) {
            if (!grouped[ev.event_date]) grouped[ev.event_date] = [];
            grouped[ev.event_date].push(ev);
          }

          for (const [dateKey, dayEvents] of Object.entries(grouped)) {
            const d = new Date(dateKey + "T12:00:00");
            const weekday = WEEKDAY_PT[d.getDay()];
            const dayFormatted = d.toLocaleDateString(locale, { day: "numeric", month: "short" });
            lines.push(`*${weekday}, ${dayFormatted}*`);

            for (const ev of dayEvents) {
              const emoji = EVENT_TYPE_EMOJIS[ev.event_type] ?? "📌";
              const time = ev.event_time ? ` às ${ev.event_time.slice(0, 5)}` : "";
              const loc = ev.location ? ` · 📍 ${ev.location}` : "";
              lines.push(`  ${emoji} ${ev.title}${time}${loc}`);
            }
            lines.push("");
          }
        }

        // Lista lembretes da semana
        if (hasReminders) {
          if (userLang === "en") {
            lines.push(`*Reminders this week*`);
          } else if (userLang === "es") {
            lines.push(`*Recordatorios esta semana*`);
          } else {
            lines.push(`*Lembretes da semana*`);
          }

          for (const rem of reminders!) {
            const remDate = new Date(rem.send_at);
            const dayName = remDate.toLocaleDateString(locale, { timeZone: userTz, weekday: "short" });
            const remTime = remDate.toLocaleTimeString(locale, { timeZone: userTz, hour: "2-digit", minute: "2-digit" });
            const recurTag = rem.recurrence && rem.recurrence !== "none" ? ` _(recorrente)_` : "";
            lines.push(`  🔔 *${rem.title}* — ${dayName} às ${remTime}${recurTag}`);
          }
          lines.push("");
        }

        if (userLang === "en") {
          lines.push(`Have a great week, ${userName}! 💪`);
        } else if (userLang === "es") {
          lines.push(`¡Que tengas una excelente semana, ${userName}! 💪`);
        } else {
          lines.push(`Tenha uma ótima semana, ${userName}! 💪`);
        }

        message = lines.join("\n");
      }

      await sendText(user.phone_number, message);

      // Registra como enviado
      await supabase.from("reminders").insert({
        user_id: user.id,
        whatsapp_number: user.phone_number,
        title: "Resumo semanal",
        message: message.slice(0, 500),
        send_at: new Date().toISOString(),
        recurrence: "none",
        source: "weekly_briefing",
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      sent++;
      console.log(`[weekly-briefing] ✅ Sent to user ${user.id}`);
    } catch (err) {
      failed++;
      console.error(`[weekly-briefing] ❌ Failed for user ${user.id}:`, err);
    }
  }

  const result = { sent, skipped, failed, date: todayInTz("America/Sao_Paulo") };
  console.log("[weekly-briefing] Done:", result);
  return new Response(JSON.stringify(result));
});
