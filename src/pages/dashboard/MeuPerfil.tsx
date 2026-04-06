import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save } from "lucide-react";

const timezones = [
  "America/Sao_Paulo", "America/Fortaleza", "America/Manaus", "America/Cuiaba",
  "America/Belem", "America/Recife", "America/Bahia", "America/Porto_Velho",
  "America/Rio_Branco", "America/Noronha",
];

export default function MeuPerfil() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
    setProfile(data);
    setLoading(false);
  };

  const handleSave = async () => {
    const { error } = await supabase.from("profiles").update({
      display_name: profile.display_name,
      phone_number: profile.phone_number,
      timezone: profile.timezone,
    }).eq("id", user!.id);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Perfil atualizado!");
  };

  if (loading) return <Skeleton className="h-64 max-w-lg" />;
  if (!profile) return null;

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input value={profile.display_name || ""} onChange={e => setProfile({...profile, display_name: e.target.value})} placeholder="Como quer ser chamado" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="opacity-60" />
          </div>
          <div className="space-y-2">
            <Label>Telefone / WhatsApp</Label>
            <Input value={profile.phone_number || ""} onChange={e => setProfile({...profile, phone_number: e.target.value})} placeholder="+55 (11) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>Fuso horário</Label>
            <Select value={profile.timezone} onValueChange={v => setProfile({...profile, timezone: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{timezones.map(tz => <SelectItem key={tz} value={tz}>{tz.replace("America/", "")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Salvar perfil</Button>
        </CardContent>
      </Card>
    </div>
  );
}
