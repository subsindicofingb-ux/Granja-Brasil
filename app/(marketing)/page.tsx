import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BRAND_TAGLINE } from "@/lib/brand";
import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/70 via-background to-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <BrandLogo href="/" size="sm" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Cadastrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center sm:text-left">
          <div className="mb-6 flex justify-center sm:justify-start">
            <BrandLogo size="hero" showTagline priority />
          </div>
          <p className="mb-3 text-sm font-medium text-primary">Administração de condomínios</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Gerencie unidades, moradores e reservas em um só lugar
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:mt-6 sm:text-lg">
            {BRAND_TAGLINE}. Cadastre a estrutura do condomínio, controle moradores e permita
            reservas de áreas comuns com segurança.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button size="lg" className="h-11 w-full sm:w-auto" asChild>
              <Link href="/login">
                Acessar painel
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-11 w-full sm:w-auto" asChild>
              <Link href="/signup">Criar conta</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:mt-20 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {[
            { title: "Unidades", desc: "Apartamentos e casas cadastradas." },
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
