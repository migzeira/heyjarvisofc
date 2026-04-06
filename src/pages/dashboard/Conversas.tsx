import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquare, Search, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Conversas() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { if (user) loadConversations(); }, [user]);

  const loadConversations = async () => {
    const { data } = await supabase.from("conversations").select("*").eq("user_id", user!.id).order("last_message_at", { ascending: false });
    setConversations(data ?? []);
    setLoading(false);
  };

  const loadMessages = async (convo: any) => {
    setSelectedConvo(convo);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convo.id).order("created_at");
    setMessages(data ?? []);
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  if (selectedConvo) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedConvo(null)} className="text-muted-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="font-medium text-sm">{selectedConvo.phone_number}</p>
            <p className="text-xs text-muted-foreground">{selectedConvo.message_count} mensagens</p>
          </div>
          <ScrollArea className="h-[500px] p-4">
            <div className="space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-xl px-4 py-2 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent"}`}>
                    <p className="text-sm">{m.content}</p>
                    <p className={`text-xs mt-1 ${m.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {format(new Date(m.created_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem nesta conversa.</p>}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  const filtered = conversations.filter(c => !search || c.phone_number?.includes(search) || c.summary?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Conversas</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar conversa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="bg-card border-border cursor-pointer hover:border-primary/30 transition-colors" onClick={() => loadMessages(c)}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.phone_number}</p>
                  <p className="text-sm text-muted-foreground truncate">{c.summary || "Sem resumo"}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{c.last_message_at ? format(new Date(c.last_message_at), "dd/MM HH:mm") : ""}</p>
                  <p className="text-xs text-muted-foreground/60">{c.message_count} msgs</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma conversa ainda.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">As conversas aparecerão aqui quando você começar a usar o agente no WhatsApp.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
