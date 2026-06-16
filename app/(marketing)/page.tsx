import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-semibold">
            <Building2 className="h-5 w-5 text-primary" />
            Condomínio SaaS
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Começar agora</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-medium text-primary">
            Administração de condomínios simplificada
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Gerencie torres, unidades, moradores e reservas em um só lugar
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Cadastre a estrutura do condomínio, controle moradores e permita
            reservas de áreas comuns com segurança e organização.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/login">
                Acessar painel
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Torres & unidades", desc: "Estruture blocos e apartamentos." },
            { title: "Moradores", desc: "Proprietários, inquilinos e dependentes." },
            { title: "Espaços comuns", desc: "Salão, churrasqueira, academia e mais." },
            { title: "Reservas", desc: "Agenda com controle de conflitos." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
