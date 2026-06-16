"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpAction } from "@/lib/auth/actions";
import { REGISTRATION_UNIT_KIND, RESIDENT_TYPES } from "@/lib/constants";
import { RESIDENT_TYPE_OPTIONS } from "@/lib/residents/labels";
import type { PublicCondominiumOption } from "@/lib/services/registration-requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignUpFormProps {
  condominiums: PublicCondominiumOption[];
}

export function SignUpForm({ condominiums }: SignUpFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(signUpAction, {});

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.redirectTo, router]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" name="full_name" placeholder="Maria Silva" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>

      <div className="rounded-md border bg-muted/30 p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Pré-qualificação</p>
          <p className="text-xs text-muted-foreground">
            Informe seu condomínio e unidade. O síndico receberá sua solicitação para aprovação.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="condominium_id">Condomínio</Label>
          <select
            id="condominium_id"
            name="condominium_id"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Selecione o condomínio
            </option>
            {condominiums.map((condo) => (
              <option key={condo.id} value={condo.id}>
                {condo.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resident_type">Você é</Label>
          <select
            id="resident_type"
            name="resident_type"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            defaultValue={RESIDENT_TYPES.OWNER}
            required
          >
            {RESIDENT_TYPE_OPTIONS.filter(
              (option) =>
                option.value === RESIDENT_TYPES.OWNER || option.value === RESIDENT_TYPES.TENANT,
            ).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit_kind">Tipo de moradia</Label>
          <select
            id="unit_kind"
            name="unit_kind"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            defaultValue={REGISTRATION_UNIT_KIND.APARTMENT}
            required
          >
            <option value={REGISTRATION_UNIT_KIND.APARTMENT}>Apartamento</option>
            <option value={REGISTRATION_UNIT_KIND.HOUSE}>Casa</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit_number">Número do apartamento ou casa</Label>
          <Input
            id="unit_number"
            name="unit_number"
            placeholder="Ex: 101 ou Casa 12"
            required
          />
        </div>
      </div>

      <Button className="w-full" type="submit" disabled={pending || condominiums.length === 0}>
        {pending ? "Criando conta..." : "Criar conta e solicitar acesso"}
      </Button>

      {condominiums.length === 0 && (
        <p className="text-center text-xs text-amber-700">
          Nenhum condomínio disponível para cadastro no momento.
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
