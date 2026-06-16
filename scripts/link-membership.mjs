/**
 * Bootstrap do primeiro admin — executar após criar usuário em /signup
 *
 * Uso:
 *   node scripts/link-membership.mjs admin@example.com admin
 *   node scripts/link-membership.mjs sindico@example.com syndic
 *
 * Requer .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const email = process.argv[2]?.toLowerCase();
const role = process.argv[3] ?? "admin";
const condoId = process.argv[4] ?? "a0000000-0000-4000-8000-000000000001";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !url || !serviceKey) {
  console.error(
    "Uso: node scripts/link-membership.mjs <email> [role] [condominium_id]\n" +
      "Variáveis: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (listError) {
  console.error("Erro ao listar usuários:", listError.message);
  process.exit(1);
}

const user = listed.users.find((u) => u.email?.toLowerCase() === email);

if (!user) {
  console.error(`Usuário não encontrado: ${email}. Crie a conta em /signup primeiro.`);
  process.exit(1);
}

const fullName =
  user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuário";

await admin.from("profiles").upsert(
  { id: user.id, full_name: fullName },
  { onConflict: "id" },
);

const { error: membershipError } = await admin.from("memberships").upsert(
  {
    profile_id: user.id,
    condominium_id: condoId,
    role,
  },
  { onConflict: "profile_id,condominium_id" },
);

if (membershipError) {
  console.error("Erro ao criar membership:", membershipError.message);
  process.exit(1);
}

console.log(`OK: ${email} vinculado como "${role}" no condomínio ${condoId}`);
