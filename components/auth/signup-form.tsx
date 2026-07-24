"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
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
import { PhotoField } from "@/components/shared/photo-field";
import { LegalScrollAcceptance } from "@/components/auth/legal-scroll-acceptance";
import { PasswordRequirementsHint } from "@/components/auth/password-requirements-hint";
import {
  isPasswordPolicyCompliant,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/password-policy";
import { PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal/terms-content";
import {
  buildInternationalPhone,
  DEFAULT_PHONE_COUNTRY_DIAL,
  PHONE_COUNTRY_OPTIONS,
} from "@/lib/auth/phone-countries";

interface SignUpFormProps {
  condominiums: PublicCondominiumOption[];
  oauthUser?: { email: string; fullName: string } | null;
}

export function SignUpForm({ condominiums, oauthUser = null }: SignUpFormProps) {
  const isGoogleSignUp = Boolean(oauthUser);
  const [state, formAction, pending] = useActionState(signUpAction, {});
  const [fullName, setFullName] = useState(oauthUser?.fullName ?? "");
  const [email, setEmail] = useState(oauthUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [phoneCountryDial, setPhoneCountryDial] = useState(DEFAULT_PHONE_COUNTRY_DIAL);
  const [phoneNational, setPhoneNational] = useState("");
  const [selectedCondoId, setSelectedCondoId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [selectedProfileType, setSelectedProfileType] = useState<RegistrationProfileType>(
    REGISTRATION_PROFILE_TYPES.RESIDENT,
  );
  const [units, setUnits] = useState<PublicUnitOption[]>([]);
  const [unitsLoading, startUnitsTransition] = useTransition();
  const [acceptedTermsOfUse, setAcceptedTermsOfUse] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);

  const phone = useMemo(
    () => buildInternationalPhone(phoneCountryDial, phoneNational),
    [phoneCountryDial, phoneNational],
  );

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
    (isGoogleSignUp || (email.trim().length > 0 && isPasswordPolicyCompliant(password))) &&
    selectedCondoId &&
    hasRequiredUnit &&
    acceptedTermsOfUse &&
    acceptedPrivacyPolicy;

  return (
    <div className="space-y-4">
      {!isGoogleSignUp && (
        <>
          <GoogleAuthButton redirectTo="/signup" label="Cadastrar com Google" />
          <AuthDivider />
        </>
      )}

      {isGoogleSignUp && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Conta Google conectada: <span className="font-medium">{oauthUser?.email}</span>
        </div>
      )}

      <form action={formAction} encType="multipart/form-data" className="space-y-4">
      {isGoogleSignUp && <input type="hidden" name="auth_mode" value="google" />}
      <input type="hidden" name="full_name" value={fullName} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={password} />
      <input type="hidden" name="phone" value={phone} />
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
          autoComplete="name"
          required
        />
      </div>

      {!isGoogleSignUp ? (
        <>
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
            <p className="text-xs text-muted-foreground">
              Use um e-mail real e permanente. Enviaremos um link de confirmação. Prefira também
              “Cadastrar com Google”.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <PasswordRequirementsHint />
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="phone_national">Celular</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(10rem,12rem)_1fr]">
          <select
            id="phone_country"
            aria-label="Código do país"
            value={phoneCountryDial}
            onChange={(event) => setPhoneCountryDial(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {PHONE_COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.dial}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            id="phone_national"
            type="tel"
            value={phoneNational}
            onChange={(event) => setPhoneNational(event.target.value)}
            placeholder="Número sem o DDI"
            autoComplete="tel-national"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Inclua o código do país. Moradores fora do Brasil também podem se cadastrar.
        </p>
      </div>

      <PhotoField label="Foto (opcional)" enableCamera />

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
          {selectedProfileType === REGISTRATION_PROFILE_TYPES.OTHER && (
            <p className="text-xs text-muted-foreground">
              Após o envio, o responsável do condomínio definirá sua função e liberará o acesso.
            </p>
          )}
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

      <div className="space-y-4 rounded-md border bg-muted/30 p-4">
        <div>
          <p className="text-sm font-medium">Termos e privacidade</p>
          <p className="text-xs text-muted-foreground">
            Leia cada documento até o final e marque as opções abaixo para continuar.
          </p>
        </div>

        <LegalScrollAcceptance
          document={TERMS_OF_USE}
          checkboxLabel="Li o termo de uso"
          name="accepted_terms_of_use"
          checked={acceptedTermsOfUse}
          onCheckedChange={setAcceptedTermsOfUse}
        />

        <LegalScrollAcceptance
          document={PRIVACY_POLICY}
          checkboxLabel="Li o termo de Privacidade"
          name="accepted_privacy_policy"
          checked={acceptedPrivacyPolicy}
          onCheckedChange={setAcceptedPrivacyPolicy}
        />
      </div>

      <Button className="w-full" type="submit" disabled={pending || !canSubmit}>
        {pending
          ? "Enviando solicitação..."
          : isGoogleSignUp
            ? "Concluir cadastro e solicitar acesso"
            : "Criar conta e solicitar acesso"}
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
    </div>
  );
}
