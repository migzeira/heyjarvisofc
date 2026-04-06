import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, CalendarDays, Check } from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Agenda() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState("week");
  const [form, setForm] = useState({ title: "", description: "", event_date: format(new Date(), "yyyy-MM-dd"), event_time: "", reminder: false });

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from("events").select("*").eq("user_id", user!.id).order("event_date").order("event_time");
    setEvents(data ?? []);
    setLoading(false);
  };

  const now = new Date();
  const filtered = events.filter(e => {
    const d = new Date(e.event_date + "T12:00:00");
    if (filter === "week") {
      const weekLater = new Date(now);
      weekLater.setDate(weekLater.getDate() + 7);
      return d >= now && d <= weekLater;
    }
    if (filter === "month") {
      const monthLater = new Date(now);
      monthLater.setMonth(monthLater.getMonth() + 1);
      return d >= now && d <= monthLater;
    }
    return true;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("events").insert({
      user_id: user!.id,
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      event_time: form.event_time || null,
      reminder: form.reminder,
      source: "manual",
    });
    if (error) toast.error("Erro ao adicionar");
    else { toast.success("Compromisso adicionado!"); setDialogOpen(false); setForm({ title: "", description: "", event_date: format(new Date(), "yyyy-MM-dd"), event_time: "", reminder: false }); loadData(); }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    await supabase.from("events").update({ status: newStatus }).eq("id", id);
    toast.success(newStatus === "done" ? "Concluído!" : "Reaberto!");
    loadData();
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Adicionar</Button></DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Novo compromisso</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} required /></div>
                <div className="space-y-2"><Label>Hora</Label><Input type="time" value={form.event_time} onChange={e => setForm({...form, event_time: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.reminder} onCheckedChange={v => setForm({...form, reminder: v})} /><Label>Lembrete</Label></div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {[{ v: "week", l: "7 dias" }, { v: "month", l: "Este mês" }, { v: "all", l: "Todos" }].map(f => (
          <Button key={f.v} variant={filter === f.v ? "default" : "outline"} size="sm" onClick={() => setFilter(f.v)}>{f.l}</Button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(e => {
            const eventDate = new Date(e.event_date + "T12:00:00");
            const today = isToday(eventDate);
            return (
              <Card key={e.id} className={`bg-card border-border ${today ? "ring-1 ring-primary/50" : ""}`}>
                <CardContent className="py-4 flex items-center gap-4">
                  <button onClick={() => toggleStatus(e.id, e.status)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${e.status === "done" ? "bg-success border-success" : "border-border hover:border-primary"}`}>
                    {e.status === "done" && <Check className="h-4 w-4 text-success-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${e.status === "done" ? "line-through text-muted-foreground" : ""}`}>{e.title}</p>
                      {today && <Badge className="bg-primary/20 text-primary text-xs">Hoje</Badge>}
                      {e.status === "cancelled" && <Badge variant="destructive" className="text-xs">Cancelado</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{format(eventDate, "dd 'de' MMMM", { locale: ptBR })} {e.event_time ? `às ${e.event_time.slice(0, 5)}` : ""}</p>
                    {e.description && <p className="text-sm text-muted-foreground/70 mt-1 truncate">{e.description}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum compromisso encontrado.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Adicione pelo painel ou pelo WhatsApp!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
