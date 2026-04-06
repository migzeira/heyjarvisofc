import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, TrendingDown, TrendingUp, Wallet, ArrowUpDown } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Financas() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({ description: "", amount: "", type: "expense", category: "outros", transaction_date: format(new Date(), "yyyy-MM-dd") });
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const [txRes, catRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user!.id).order("transaction_date", { ascending: false }).limit(100),
      supabase.from("categories").select("*").eq("user_id", user!.id).order("name"),
    ]);
    setTransactions(txRes.data ?? []);
    setCategories(catRes.data ?? []);
    setLoading(false);
  };

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthTx = transactions.filter(t => {
    const d = new Date(t.transaction_date + "T12:00:00");
    return d >= monthStart && d <= monthEnd;
  });

  const totalExpenses = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = monthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);

  const catData = Object.entries(
    monthTx.filter(t => t.type === "expense").reduce((acc: any, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {})
  ).map(([name, total]) => ({ name, total }));

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(now, 5 - i);
    const ms = startOfMonth(m);
    const me = endOfMonth(m);
    const txs = transactions.filter(t => {
      const d = new Date(t.transaction_date + "T12:00:00");
      return d >= ms && d <= me;
    });
    return {
      month: format(m, "MMM", { locale: ptBR }),
      gastos: txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
      receitas: txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  const filteredTx = transactions.filter(t => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("transactions").insert({
      user_id: user!.id,
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      category: form.category,
      transaction_date: form.transaction_date,
      source: "manual",
    });
    if (error) toast.error("Erro ao adicionar");
    else {
      toast.success("Transação adicionada!");
      setDialogOpen(false);
      setForm({ description: "", amount: "", type: "expense", category: "outros", transaction_date: format(new Date(), "yyyy-MM-dd") });
      loadData();
    }
  };

  const handleAddCategory = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase.from("categories").insert({ user_id: user!.id, name: newCat.trim(), is_default: false });
    if (error) toast.error("Erro ao criar categoria");
    else {
      toast.success("Categoria criada!");
      setNewCat("");
      setCatDialogOpen(false);
      loadData();
    }
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Finanças</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Nova transação</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="expense">Gasto</SelectItem><SelectItem value="income">Receita</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={form.transaction_date} onChange={e => setForm({...form, transaction_date: e.target.value})} />
                </div>
              </div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase">Gastos do mês</p>
                <p className="text-2xl font-bold text-destructive mt-1">R$ {totalExpenses.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase">Receitas do mês</p>
                <p className="text-2xl font-bold text-success mt-1">R$ {totalIncome.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase">Saldo</p>
                <p className={`text-2xl font-bold mt-1 ${totalIncome - totalExpenses >= 0 ? "text-success" : "text-destructive"}`}>R$ {(totalIncome - totalExpenses).toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-base">Gastos por categoria</CardTitle></CardHeader>
              <CardContent>
                {catData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={catData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 10% 18%)" />
                      <XAxis dataKey="name" stroke="hsl(240 5% 65%)" fontSize={11} />
                      <YAxis stroke="hsl(240 5% 65%)" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(240 12% 7%)", border: "1px solid hsl(240 10% 18%)", borderRadius: "8px", color: "#fff" }} />
                      <Bar dataKey="total" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-sm text-center py-10">Nenhum dado este mês.</p>}
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-base">Últimos 6 meses</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 10% 18%)" />
                    <XAxis dataKey="month" stroke="hsl(240 5% 65%)" fontSize={11} />
                    <YAxis stroke="hsl(240 5% 65%)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(240 12% 7%)", border: "1px solid hsl(240 10% 18%)", borderRadius: "8px", color: "#fff" }} />
                    <Line type="monotone" dataKey="gastos" stroke="hsl(0 84% 60%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="receitas" stroke="hsl(142 76% 36%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transacoes" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filteredTx.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTx.map(t => (
                    <TableRow key={t.id} className="border-border">
                      <TableCell className="text-sm">{format(new Date(t.transaction_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm">{t.description}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{t.category}</Badge></TableCell>
                      <TableCell>{t.type === "expense" ? <TrendingDown className="h-4 w-4 text-destructive" /> : <TrendingUp className="h-4 w-4 text-success" />}</TableCell>
                      <TableCell className={`text-right font-medium ${t.type === "expense" ? "text-destructive" : "text-success"}`}>R$ {Number(t.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma transação encontrada.</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Comece conversando com seu agente no WhatsApp!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Nova categoria</Button></DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Ex: Investimentos" />
                  </div>
                  <Button onClick={handleAddCategory} className="w-full">Criar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(c => {
              const total = transactions.filter(t => t.category === c.name && t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
              return (
                <Card key={c.id} className="bg-card border-border">
                  <CardContent className="pt-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{c.icon || "📦"}</span>
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        {c.is_default && <span className="text-xs text-muted-foreground">Padrão</span>}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">R$ {total.toFixed(2)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
