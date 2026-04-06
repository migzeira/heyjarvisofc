import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, StickyNote, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Anotacoes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", content: "" });

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from("notes").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
    setNotes(data ?? []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("notes").insert({ user_id: user!.id, title: form.title || null, content: form.content, source: "manual" });
    if (error) toast.error("Erro ao salvar");
    else { toast.success("Anotação salva!"); setDialogOpen(false); setForm({ title: "", content: "" }); loadData(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) toast.error("Erro ao deletar");
    else { toast.success("Anotação deletada"); loadData(); }
  };

  const filtered = notes.filter(n => {
    const q = search.toLowerCase();
    return !q || n.title?.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  if (loading) return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Anotações</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nova anotação</Button></DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Nova anotação</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2"><Label>Título (opcional)</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Ex: Ideia para projeto" /></div>
              <div className="space-y-2"><Label>Conteúdo</Label><Textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={5} required /></div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar anotações..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(n => (
            <Card key={n.id} className="bg-card border-border group hover:border-primary/30 transition-colors">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-sm truncate flex-1">{n.title || n.content.slice(0, 40)}</h3>
                  <button onClick={() => handleDelete(n.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-2">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{n.content}</p>
                <p className="text-xs text-muted-foreground/60 mt-3">{format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <StickyNote className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma anotação encontrada.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Salve ideias pelo WhatsApp ou pelo painel!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
