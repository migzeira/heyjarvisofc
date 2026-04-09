import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to Supabase Realtime postgres_changes for the given tables.
 * Calls onUpdate() whenever INSERT, UPDATE, or DELETE happens on any table.
 * Stable across re-renders via useRef for the callback.
 */
export function useRealtimeSync(
  tables: string[],
  userId: string | undefined,
  onUpdate: () => void
): void {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  const tableKey = tables.join(",");

  useEffect(() => {
    if (!userId) return;

    const channelName = `realtime-${tableKey.replace(/,/g, "-")}-${userId.slice(0, 8)}`;
    const channel = supabase.channel(channelName);

    for (const table of tables) {
      channel.on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          filter: `user_id=eq.${userId}`,
        },
        () => {
          callbackRef.current();
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableKey, userId]);
}
