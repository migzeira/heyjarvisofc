import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { toast } from "sonner";

const plans = [
  { id: "starter", name: "Starter", price: "R$ 49/mês", limit: 500, features: ["500 mensagens/mês", "Módulo financeiro", "Módulo agenda", "Painel de controle", "Suporte por email"] },
  { id: "pro", name: "Pro", price: "R$ 99/mês", limit: 2000, features: ["2.000 mensagens/mês", "Todos os módulos", "Integrações (Notion, Google)", "Respostas rápidas", "Suporte prioritário"] },
  { id: "business", name: "Business", price: "R$ 199/mês", limit: 999999, features: ["Mensagens ilimitadas", "Tudo do Pro", "Suporte 24/7", "API dedicada", "Múltiplos agentes"] },
];

export default function MeuPlano() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
    setProfile(data);
    setLoading(false);
  };

  const handlePlanChange = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const { error } = await supabase.from("profiles").update({ plan: planId, messages_limit: plan.limit }).eq("id", user!.id);
    if (error) toast.error("Erro ao alterar plano");
    else { toast.success(`Plano alterado para ${plan.name}!`); loadData(); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-32" /><div className="grid md:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-64" />)}</div></div>;

  const currentPlan = plans.find(p => p.id === profile?.plan) || plans[0];
  const usagePercent = profile ? Math.min((profile.messages_used / profile.messages_limit) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meu Plano</h1>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{currentPlan.name}</h2>
                <Badge className="bg-primary/20 text-primary">Atual</Badge>
              </div>
              <p className="text-muted-foreground text-sm">{currentPlan.price}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mensagens usadas</span>
              <span>{profile?.messages_used ?? 0} / {profile?.messages_limit ?? 500}</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map(p => (
          <Card key={p.id} className={`bg-card border-border ${p.id === profile?.plan ? "ring-1 ring-primary" : ""}`}>
            <CardHeader className="text-center">
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.price}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              {p.id === profile?.plan ? (
                <Button variant="outline" className="w-full" disabled>Plano atual</Button>
              ) : (
                <Button className="w-full" variant={plans.indexOf(p) > plans.findIndex(pl => pl.id === profile?.plan) ? "default" : "outline"} onClick={() => handlePlanChange(p.id)}>
                  {plans.indexOf(p) > plans.findIndex(pl => pl.id === profile?.plan) ? "Fazer upgrade" : "Fazer downgrade"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground text-center">Dúvidas sobre planos? Fale conosco no WhatsApp</p>
    </div>
  );
}
