/**
 * send-reminder
 * Chamada pelo pg_cron a cada 1 minuto.
 * Busca lembretes pendentes cujo send_at <= agora e envia via WhatsApp.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText } from "../_shared/evolution.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  // Protege a rota: só aceita chamadas internas (cron ou service role)
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date().toISOString();

  // Busca lembretes pendentes
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", now)
    .limit(50); // processa até 50 por vez

  if (error) {
    console.error("Error fetching reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  if (!reminders || reminders.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }));
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    try {
      await sendText(reminder.whatsapp_number, reminder.message);

      await supabase
        .from("reminders")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", reminder.id);

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder ${reminder.id}:`, err);

      await supabase
        .from("reminders")
        .update({ status: "failed" })
        .eq("id", reminder.id);

      failed++;
    }
  }

  console.log(`Reminders processed: ${sent} sent, ${failed} failed`);
  return new Response(JSON.stringify({ sent, failed }));
});
