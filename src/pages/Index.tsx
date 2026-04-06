import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, CreditCard, Settings, Wallet, CalendarDays, StickyNote, Bot, Check, ArrowRight } from "lucide-react";

const steps = [
  { icon: CreditCard, title: "Assine um plano", desc: "Escolha o plano ideal para você e comece em minutos." },
  { icon: Settings, title: "Configure no painel", desc: "Personalize seu agente de IA no dashboard." },
  { icon: MessageCircle, title: "Converse no WhatsApp", desc: "Mande mensagens e deixe a IA cuidar do resto." },
];

const features = [
  { icon: Wallet, title: "Finanças", desc: "Registre gastos e receitas por mensagem. Veja relatórios no painel." },
  { icon: CalendarDays, title: "Agenda", desc: "Crie compromissos e receba lembretes automáticos." },
  { icon: StickyNote, title: "Anotações", desc: "Salve ideias, notas e informações importantes." },
  { icon: Bot, title: "Conversa inteligente", desc: "Pergunte qualquer coisa — a IA responde com contexto." },
];

const plans = [
  { name: "Starter", price: "49", msgs: "500 mensagens", features: ["Módulo financeiro", "Módulo agenda", "Painel de controle", "Suporte por email"], highlight: false },
  { name: "Pro", price: "99", msgs: "2.000 mensagens", features: ["Todos os módulos", "Integrações (Notion, Google)", "Respostas rápidas", "Suporte prioritário"], highlight: true },
  { name: "Business", price: "199", msgs: "Mensagens ilimitadas", features: ["Tudo do Pro", "Suporte prioritário 24/7", "API dedicada", "Múltiplos agentes"], highlight: false },
];

const faqs = [
  { q: "Como o agente funciona no WhatsApp?", a: "Após configurar, você conversa normalmente pelo WhatsApp. A IA interpreta suas mensagens e executa ações como registrar gastos, criar compromissos ou salvar anotações automaticamente." },
  { q: "Preciso instalar algum aplicativo?", a: "Não! Você usa o WhatsApp que já tem no celular. A configuração é feita pelo painel web." },
  { q: "Meus dados estão seguros?", a: "Sim. Usamos criptografia e os dados ficam isolados por usuário com políticas de segurança rigorosas." },
  { q: "Posso trocar de plano a qualquer momento?", a: "Sim, você pode fazer upgrade ou downgrade a qualquer momento pelo painel." },
  { q: "O que acontece se eu atingir o limite de mensagens?", a: "O agente pausa até o próximo ciclo ou até você fazer um upgrade de plano." },
  { q: "Posso personalizar as respostas do agente?", a: "Sim! Você pode definir o tom de voz, idioma, instruções personalizadas e até respostas rápidas para comandos específicos." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">MayaChat</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
            <Button asChild><Link to="/signup">Começar agora</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-24 pb-20 text-center">
        <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">✨ Seu assistente pessoal de IA</Badge>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          Seu assistente de IA pessoal no{" "}
          <span className="text-primary">WhatsApp</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Controle suas finanças, organize sua agenda e faça anotações — tudo conversando pelo WhatsApp com sua IA.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-base px-8 py-6" asChild>
            <Link to="/signup">Começar agora <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8 py-6" asChild>
            <a href="#como-funciona">Como funciona</a>
          </Button>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Como funciona</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-lg mx-auto">Três passos simples para começar</p>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => (
            <Card key={i} className="bg-card border-border text-center group hover:border-primary/40 transition-colors">
              <CardContent className="pt-8 pb-6">
                <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <s.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="text-xs text-primary font-semibold mb-2">PASSO {i + 1}</div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">O que seu assistente faz</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-lg mx-auto">Módulos inteligentes para o seu dia a dia</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <Card key={i} className="bg-card border-border group hover:border-primary/40 transition-colors">
              <CardContent className="pt-6 pb-5">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Planos e preços</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-lg mx-auto">Escolha o plano ideal para você</p>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((p, i) => (
            <Card key={i} className={`bg-card border-border relative ${p.highlight ? "border-primary ring-1 ring-primary" : ""}`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3">Mais popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{p.name}</CardTitle>
                <CardDescription>{p.msgs}/mês</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <ul className="space-y-3 text-sm text-left mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={p.highlight ? "default" : "outline"} asChild>
                  <Link to="/signup">Começar agora</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-20 max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-4">Perguntas frequentes</h2>
        <p className="text-muted-foreground text-center mb-12">Tudo que você precisa saber</p>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4 bg-card">
              <AccordionTrigger className="text-left hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span className="font-semibold">MayaChat</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <Link to="/login" className="hover:text-foreground transition-colors">Entrar</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Criar conta</Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 MayaChat. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
