"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
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
  const [state, formAction, pending] = useActionState(signUpAction, {});
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [selectedCondoId, setSelectedCondoId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
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
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo]);

  useEffect(() => {
    setSelectedUnitId("");
    setUnitNumber("");
  }, [selectedCondoId, selectedProfileType]);

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

  const hasRequiredUnit =
    !requiresUnit ||
    (isGeneralCondo && unitNumber.trim().length > 0) ||
    (!isGeneralCondo && !unitsLoading && units.length > 0 && Boolean(selectedUnitId));

  const canSubmit =
    condominiums.length > 0 &&
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    selectedCondoId &&
    hasRequiredUnit;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="full_name" value={fullName} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={password} />
      <input type="hidden" name="condominium_id" value={selectedCondoId} />
      <input type="hidden" name="condominium_slug" value={selectedCondo?.slug ?? ""} />
      <input type="hidden" name="profile_type" value={selectedProfileType} />
      <input type="hidden" name="unit_id" value={selectedUnitId} />
      <input type="hidden" name="unit_number" value={unitNumber} />

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
        <Input
          id="full_name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Maria Silva"
          autoComplete="name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
          <Label htmlFor="profile_type">Você é</Label>
          <select
            id="profile_type"
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
              value={unitNumber}
              onChange={(event) => setUnitNumber(event.target.value)}
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
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={selectedUnitId}
              onChange={(event) => setSelectedUnitId(event.target.value)}
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
