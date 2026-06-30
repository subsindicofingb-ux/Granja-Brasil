"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createAccessDeviceAction,
  testAccessDeviceConnectionAction,
  updateAccessDeviceAction,
} from "@/lib/actions/access-devices";
import {
  ACCESS_DEVICE_DIRECTION_OPTIONS,
  ACCESS_DEVICE_ENTRY_KIND_OPTIONS,
  ACCESS_DEVICE_TYPE_OPTIONS,
} from "@/lib/access-devices/constants";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import type { CondominiumRecord } from "@/lib/services/condominiums-admin";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccessDeviceFormProps {
  condoSlug: string;
  mode: "create" | "edit";
  shareableCondominiums: CondominiumRecord[];
  defaultValues?: {
    deviceId?: string;
    displayName?: string;
    accessType?: string;
    manufacturer?: string;
    model?: string;
    hostUrl?: string;
    apiUsername?: string;
    direction?: string;
    entryKind?: string;
    isActive?: boolean;
    isPilot?: boolean;
    sharedCondominiumIds?: string[];
  };
}

export function AccessDeviceForm({
  condoSlug,
  mode,
  shareableCondominiums,
  defaultValues,
}: AccessDeviceFormProps) {
  const saveAction = mode === "create" ? createAccessDeviceAction : updateAccessDeviceAction;
  const [saveState, saveFormAction, savePending] = useActionState(saveAction, {});
  const [testState, testFormAction, testPending] = useActionState(
    testAccessDeviceConnectionAction,
    {},
  );
  const [hostUrl, setHostUrl] = useState(defaultValues?.hostUrl ?? "");
  const [apiUsername, setApiUsername] = useState(defaultValues?.apiUsername ?? "admin");

  return (
    <div className="space-y-6">
      <form action={saveFormAction} className="space-y-4">
        <input type="hidden" name="condo_slug" value={condoSlug} />
        {mode === "edit" && defaultValues?.deviceId && (
          <input type="hidden" name="device_id" value={defaultValues.deviceId} />
        )}

        <FormAlert error={saveState.error} success={saveState.success} />

        <div className="space-y-2">
          <Label htmlFor="display_name">Nome do local de acesso</Label>
          <Input
            id="display_name"
            name="display_name"
            placeholder="Ex: Brinquedoteca, Portaria Jacarandás"
            defaultValue={defaultValues?.displayName}
            required
          />
          <p className="text-xs text-muted-foreground">
            Nome livre definido pelo condomínio. Será usado nos checkboxes do morador.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="access_type">Tipo de uso</Label>
            <select
              id="access_type"
              name="access_type"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              defaultValue={defaultValues?.accessType ?? "facial_pedestrian"}
              required
            >
              {ACCESS_DEVICE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry_kind">Tipo de entrada</Label>
            <select
              id="entry_kind"
              name="entry_kind"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              defaultValue={defaultValues?.entryKind ?? "pedestrian"}
              required
            >
              {ACCESS_DEVICE_ENTRY_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="manufacturer">Fabricante</Label>
            <Input
              id="manufacturer"
              name="manufacturer"
              defaultValue={defaultValues?.manufacturer ?? "ControlID"}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Modelo</Label>
            <Input
              id="model"
              name="model"
              defaultValue={defaultValues?.model ?? "iDFace"}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="host_url">IP / Host público</Label>
          <Input
            id="host_url"
            name="host_url"
            placeholder="http://granjabr.dyndns.org:8080"
            value={hostUrl}
            onChange={(event) => setHostUrl(event.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="api_username">Usuário da API</Label>
            <Input
              id="api_username"
              name="api_username"
              value={apiUsername}
              onChange={(event) => setApiUsername(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api_password">Senha da API</Label>
            <Input
              id="api_password"
              name="api_password"
              type="password"
              autoComplete="new-password"
              placeholder={mode === "edit" ? "Deixe em branco para manter" : ""}
              required={mode === "create"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="direction">Direção</Label>
          <select
            id="direction"
            name="direction"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            defaultValue={defaultValues?.direction ?? "entry"}
            required
          >
            {ACCESS_DEVICE_DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {shareableCondominiums.length > 0 && (
          <div className="space-y-2">
            <Label>Visível também para</Label>
            <p className="text-xs text-muted-foreground">
              Moradores de outros condomínios poderão receber este local nos checkboxes (ex.: Academia
              compartilhada).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {shareableCondominiums.map((condominium) => (
                <label key={condominium.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="shared_condominium_ids"
                    value={condominium.id}
                    defaultChecked={defaultValues?.sharedCondominiumIds?.includes(condominium.id)}
                    className="h-4 w-4 rounded border"
                  />
                  {formatCondominiumDisplayName(condominium.name, condominium.slug)}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={defaultValues?.isActive ?? true}
              className="h-4 w-4 rounded border"
            />
            Ativo
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_pilot"
              defaultChecked={defaultValues?.isPilot ?? false}
              className="h-4 w-4 rounded border"
            />
            Equipamento piloto (testes)
          </label>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={savePending}>
            {savePending ? "Salvando..." : mode === "create" ? "Cadastrar local" : "Salvar alterações"}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/settings/access-devices`}>Cancelar</Link>
          </Button>
        </div>
      </form>

      <form action={testFormAction} className="rounded-lg border p-4 space-y-3">
        <input type="hidden" name="condo_slug" value={condoSlug} />
        {defaultValues?.deviceId && (
          <input type="hidden" name="device_id" value={defaultValues.deviceId} />
        )}
        <input type="hidden" name="host_url" value={hostUrl} />
        <input type="hidden" name="api_username" value={apiUsername} />

        <div>
          <p className="font-medium text-sm">Testar conexão ControlID</p>
          <p className="text-xs text-muted-foreground mt-1">
            Apenas login na API — não altera usuários nem faces no equipamento.
          </p>
        </div>

        <FormAlert error={testState.error} success={testState.success} />

        <div className="space-y-2">
          <Label htmlFor="test_api_password">Senha para teste</Label>
          <Input
            id="test_api_password"
            name="api_password"
            type="password"
            autoComplete="new-password"
            placeholder="Informe a senha atual do equipamento"
            required
          />
        </div>

        <Button type="submit" variant="secondary" disabled={testPending}>
          {testPending ? "Testando..." : "Testar conexão e senha"}
        </Button>
      </form>
    </div>
  );
}
