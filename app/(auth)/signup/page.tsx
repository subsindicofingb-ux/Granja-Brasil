import Link from "next/link";
import { Building2 } from "lucide-react";
import { SignUpForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Building2 className="h-5 w-5" />
          Condomínio SaaS
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight">Crie sua conta</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Após o cadastro, um administrador do condomínio precisa vincular seu usuário em
            Configurações → Membros.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} Condomínio SaaS
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
            <CardDescription>Cadastro com e-mail e senha via Supabase Auth.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignUpForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
