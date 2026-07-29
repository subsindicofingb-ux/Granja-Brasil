"use client";

import { useActionState } from "react";
import { updateMembershipProfileAction } from "@/lib/actions/membership-access";
import { FormAlert } from "@/components/shared/feedback";
import { PhotoField } from "@/components/shared/photo-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MembershipProfileFormProps {
  condoSlug: string;
  membershipId: string;
  defaultValues: {
    fullName: string;
    email: string;
    phone: string;
    avatarUrl: string | null;
  };
}

export function MembershipProfileForm({
  condoSlug,
  membershipId,
  defaultValues,
}: MembershipProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateMembershipProfileAction, {});

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="membership_id" value={membershipId} />
      <input type="hidden" name="existing_avatar_url" value={defaultValues.avatarUrl ?? ""} />

      <FormAlert error={state.error} success={state.success} />

      <PhotoField label="Foto" currentPhotoUrl={defaultValues.avatarUrl} inputName="photo" />

      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={defaultValues.fullName}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues.email}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="(11) 99999-0000"
          defaultValue={defaultValues.phone}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar dados pessoais"}
      </Button>
    </form>
  );
}
