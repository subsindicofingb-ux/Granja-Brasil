"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listSignupUnitsAction } from "@/lib/actions/signup-units";
import { signUpAction } from "@/lib/auth/actions";
import { RESIDENT_TYPES } from "@/lib/constants";
import { RESIDENT_TYPE_OPTIONS } from "@/lib/residents/labels";
import type { PublicCondominiumOption } from "@/lib/services/registration-requests";
import type { PublicUnitOption } from "@/lib/services/registration-requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignUpFormProps {
  condominiums: PublicCondominiumOption[];
}

export function SignUpForm({ condominiums }: SignUpFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(signUpAction, {});
  const [selectedCondoId, setSelectedCondoId] = useState("");
  const [units, setUnits] = useState<PublicUnitOption[]>([]);
  const [unitsLoading, startUnitsTransition] = useTransition();

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.redirectTo, router]);

  useEffect(() => {
    if (!selectedCondoId) {
      setUnits([]);
      return;
    }

    startUnitsTransition(async () => {
      const result = await listSignupUnitsAction(selectedCondoId);
      setUnits(result.ok ? (result.data ?? []) : []);
    });
  }, [selectedCondoId]);

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

      <div className="space-y-4 rounded-md border bg-muted/30 p-4">
        <div>
          <p className="text-sm font-medium">Pré-qualificação</p>
          <p className="text-xs text-muted-foreground">
            Escolha o condomínio e a unidade ou casa cadastrada. O síndico analisará sua solicitação.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="condominium_id">Condomínio</Label>
          <select
            id="condominium_id"
            name="condominium_id"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={selectedCondoId}
            onChange={(event) => setSelectedCondoId(event.target.value)}
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
          <Label htmlFor="unit_id">Unidade ou casa</Label>
          <select
            id="unit_id"
            name="unit_id"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            defaultValue=""
            disabled={!selectedCondoId || unitsLoading}
            required
          >
            <option value="" disabled>
              {unitsLoading
                ? "Carregando unidades..."
                : selectedCondoId
                  ? units.length > 0
                    ? "Selecione sua unidade ou casa"
                    : "Nenhuma unidade cadastrada neste condomínio"
                  : "Selecione o condomínio primeiro"}
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
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
      </div>

      <Button
        className="w-full"
        type="submit"
        disabled={pending || condominiums.length === 0 || !selectedCondoId || units.length === 0}
      >
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
