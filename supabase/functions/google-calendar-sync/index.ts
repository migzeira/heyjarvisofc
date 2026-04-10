/**
 * google-calendar-sync
 * Sincroniza eventos do dashboard com Google Calendar.
 * Ações: create, update, delete
 *
 * POST body:
 *   { action: "create"|"update"|"delete", event: {...}, eventId: string }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  syncGoogleCalendar,
  updateGoogleCalendar,
  deleteGoogleCalendar,
} from "../_shared/integrations.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const supabase = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // Autentica usuario
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Nao autenticado" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Verifica se Google Calendar esta conectado
    const { data: integration } = await supabase
      .from("integrations")
      .select("is_connected")
      .eq("user_id", user.id)
      .eq("provider", "google_calendar")
      .eq("is_connected", true)
      .maybeSingle();

    if (!integration) {
      return new Response(JSON.stringify({ synced: false, reason: "not_connected" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Busca timezone do usuário (para criar eventos no Google Calendar no fuso correto)
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    const userTz = (profile?.timezone as string) || "America/Sao_Paulo";

    const body = await req.json();
    const { action, event, eventId } = body;

    // ── CREATE ──
    if (action === "create" && event) {
      const googleEventId = await syncGoogleCalendar(
        user.id,
        event.title,
        event.event_date,
        event.event_time || null,
        event.end_time || null,
        event.description || null,
        event.location || null,
        userTz,
      );

      if (googleEventId && eventId) {
        // Salva google_event_id no evento local — garante idempotência:
        // próxima tentativa de sync vai cair no ramo "update" em vez de criar duplicata
        await supabase
          .from("events")
          .update({ google_event_id: googleEventId })
          .eq("id", eventId)
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ synced: true, googleEventId }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE ──
    if (action === "update" && event && event.google_event_id) {
      const ok = await updateGoogleCalendar(
        user.id,
        event.google_event_id,
        event.title,
        event.event_date,
        event.event_time || null,
        event.end_time || null,
        event.description || null,
        event.location || null,
        userTz,
      );

      return new Response(JSON.stringify({ synced: ok }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── DELETE ──
    if (action === "delete" && body.google_event_id) {
      const ok = await deleteGoogleCalendar(user.id, body.google_event_id);

      return new Response(JSON.stringify({ synced: ok }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-calendar-sync error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
