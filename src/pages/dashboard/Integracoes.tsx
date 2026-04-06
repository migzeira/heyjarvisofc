import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link2 } from "lucide-react";

const providerConfig: Record<string, { name: string; icon: string; desc: string }> = {
  google_calendar: { name: "Google Calendar", icon: "📅", desc: "Sincronize compromissos automaticamente" },
  notion: { name: "Notion", icon: "📝", desc: "Salve anotações direto no seu workspace" },
  google_sheets: { name: "Google Sheets", icon: "📊", desc: "Exporte seus dados financeiros pra planilha" },
};

export default function Integracoes() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from("integrations").select("*").eq("user_id", user!.id);
    setIntegrations(data ?? []);
    setLoading(false);
  };

  const toggleConnection = async (id: string, connected: boolean) => {
    const { error } = await supabase.from("integrations").update({
      is_connected: !connected,
      connected_at: !connected ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else { toast.success(!connected ? "Conectado!" : "Desconectado"); loadData(); }
  };

  if (loading) return <div className="grid sm:grid-cols-2 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Integrações</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map(i => {
          const config = providerConfig[i.provider] || { name: i.provider, icon: "🔗", desc: "" };
          return (
            <Card key={i.id} className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">{config.icon}</div>
                <h3 className="font-semibold mb-1">{config.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{config.desc}</p>
                <div className="flex items-center justify-between">
                  <Badge variant={i.is_connected ? "default" : "secondary"} className={i.is_connected ? "bg-success/20 text-success border-success/30" : ""}>
                    {i.is_connected ? "Conectado" : "Desconectado"}
                  </Badge>
                  <Button variant={i.is_connected ? "outline" : "default"} size="sm" onClick={() => toggleConnection(i.id, i.is_connected)}>
                    {i.is_connected ? "Desconectar" : "Conectar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {integrations.length === 0 && (
          <Card className="bg-card border-border col-span-full">
            <CardContent className="py-12 text-center">
              <Link2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma integração disponível.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
