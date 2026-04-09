import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText } from "../_shared/evolution.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  // Auth check: only service role may invoke this function
  const authHeader = req.headers.get("authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date().toISOString();

  // Fetch pending messages ready for retry
  const { data: pending, error: fetchErr } = await supabase
    .from("message_queue")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at")
    .limit(20);

  if (fetchErr) {
    console.error("[process-message-queue] Fetch error:", fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0, skipped = 0;

  for (const msg of pending ?? []) {
    const newAttempts = (msg.attempts ?? 0) + 1;

    try {
      if (msg.message_type === "text") {
        await sendText(msg.phone, msg.content);
      }
      // image and buttons: stored as JSON — implement if needed.
      // For unsupported types we mark as sent so they don't block the queue.

      await supabase
        .from("message_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: newAttempts,
        })
        .eq("id", msg.id);

      sent++;
      console.log(`[process-message-queue] Sent ${msg.id} to ${msg.phone} (attempt ${newAttempts})`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[process-message-queue] Failed ${msg.id} (attempt ${newAttempts}): ${errMsg}`);

      if (newAttempts >= (msg.max_attempts ?? 3)) {
        // Exhausted all attempts — mark permanently failed
        await supabase
          .from("message_queue")
          .update({
            status: "failed",
            attempts: newAttempts,
            last_error: errMsg,
          })
          .eq("id", msg.id);

        failed++;
        console.warn(`[process-message-queue] Permanently failed ${msg.id} after ${newAttempts} attempts`);
      } else {
        // Exponential backoff: attempt 1 → 5^1 = 5 min, attempt 2 → 5^2 = 25 min
        // (after attempt 0 the first retry happens immediately via next_attempt_at=now(),
        //  so effective schedule: failure → +5min → +25min → failed)
        const backoffMinutes = Math.pow(5, newAttempts);
        const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

        await supabase
          .from("message_queue")
          .update({
            attempts: newAttempts,
            next_attempt_at: nextAttempt,
            last_error: errMsg,
          })
          .eq("id", msg.id);

        skipped++;
        console.log(`[process-message-queue] Retry ${msg.id} scheduled in ${backoffMinutes}min (next: ${nextAttempt})`);
      }
    }
  }

  const result = { sent, failed, skipped, total: (pending ?? []).length };
  console.log("[process-message-queue] Done:", result);

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
