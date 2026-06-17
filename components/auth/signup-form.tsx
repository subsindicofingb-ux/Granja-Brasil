"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listSignupUnitsAction } from "@/lib/actions/signup-units";
import { signUpAction } from "@/lib/auth/actions";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { REGISTRATION_PROFILE_TYPES, type RegistrationProfileType } from "@/lib/constants";
import { REGISTRATION_PROFILE_TYPE_OPTIONS } from "@/lib/registrations/labels";
import { requiresRegistrationUnit } from "@/lib/registrations/profile-type";
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
  const [selectedProfileType, setSelectedProfileType] = useState<RegistrationProfileType>(
    REGISTRATION_PROFILE_TYPES.RESIDENT,
  );
  const [units, setUnits] = useState<PublicUnitOption[]>([]);
  const [unitsLoading, startUnitsTransition] = useTransition();

  const selectedCondo = useMemo(
    () => condominiums.find((condo) => condo.id === selectedCondoId),
    [condominiums, selectedCondoId],
  );
  const isGeneralCondo = selectedCondo ? isGeneralCondominium(selectedCondo.slug) : false;
  const requiresUnit = requiresRegistrationUnit(selectedProfileType);

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.redirectTo, router]);

  useEffect(() => {
    if (!selectedCondoId || isGeneralCondo || !requiresUnit) {
      setUnits([]);
      return;
    }

    startUnitsTransition(async () => {
      const result = await listSignupUnitsAction(selectedCondoId);
      setUnits(result.ok ? (result.data ?? []) : []);
    });
  }, [selectedCondoId, isGeneralCondo, requiresUnit]);

  const canSubmit =
    condominiums.length > 0 &&
    selectedCondoId &&
    (!requiresUnit || isGeneralCondo || (!unitsLoading && units.length > 0));

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
            Escolha o condomínio e informe sua unidade. O responsável analisará sua solicitação.
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
          <input
            type="hidden"
            name="condominium_slug"
            value={selectedCondo?.slug ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile_type">Você é</Label>
          <select
            id="profile_type"
            name="profile_type"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={selectedProfileType}
            onChange={(event) =>
              setSelectedProfileType(event.target.value as RegistrationProfileType)
            }
            required
          >
            {REGISTRATION_PROFILE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {requiresUnit && isGeneralCondo ? (
          <div className="space-y-2">
            <Label htmlFor="unit_number">Unidade</Label>
            <Input
              id="unit_number"
              name="unit_number"
              placeholder="Ex: Bloco A · Apto 101 ou Casa 12"
              required
            />
            <p className="text-xs text-muted-foreground">
              No condomínio geral Granja Brasil, digite livremente sua unidade ou casa.
            </p>
          </div>
        ) : requiresUnit ? (
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
        ) : null}
      </div>

      <Button className="w-full" type="submit" disabled={pending || !canSubmit}>
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
