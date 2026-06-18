/**
 * Cadastra unidades 101–706 (7 andares × 6 aptos) nos condomínios Bromélias,
 * Orquídeas e Quaresmas.
 *
 * Uso:
 *   node scripts/seed-granja-condo-units.mjs
 *   node scripts/seed-granja-condo-units.mjs --dry-run
 *
 * Requer .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const CONDOMINIUM_LOOKUP = [
  { label: "Bromélias", patterns: ["bromélia", "bromelia"] },
  { label: "Orquídeas", patterns: ["orquídea", "orquidea"] },
  { label: "Quaresmas", patterns: ["quaresma"] },
];

const DEFAULT_TOWER_NAME = "Unidades";
const BATCH_SIZE = 100;

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

function generateApartmentNumbers() {
  const numbers = [];
  for (let floor = 1; floor <= 7; floor += 1) {
    for (let apartment = 1; apartment <= 6; apartment += 1) {
      numbers.push(String(floor * 100 + apartment));
    }
  }
  return numbers;
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesCondominium(name, patterns) {
  const normalizedName = normalize(name);
  return patterns.some((pattern) => normalizedName.includes(normalize(pattern)));
}

async function findCondominium(admin, lookup) {
  const { data, error } = await admin
    .from("condominiums")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const match = (data ?? []).find((condominium) =>
    matchesCondominium(condominium.name, lookup.patterns),
  );

  if (!match) {
    return null;
  }

  return match;
}

async function getOrCreateDefaultTower(admin, condominiumId) {
  const { data: existingTower, error: existingError } = await admin
    .from("towers")
    .select("id, name")
    .eq("condominium_id", condominiumId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingTower) {
    return existingTower;
  }

  const { data: createdTower, error: createError } = await admin
    .from("towers")
    .insert({
      condominium_id: condominiumId,
      name: DEFAULT_TOWER_NAME,
      floors: 7,
    })
    .select("id, name")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return createdTower;
}

async function listExistingUnitKeys(admin, towerId, block) {
  const { data, error } = await admin
    .from("units")
    .select("number")
    .eq("tower_id", towerId)
    .eq("block", block);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((unit) => unit.number));
}

loadEnv();

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Variáveis obrigatórias: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const apartmentNumbers = generateApartmentNumbers();

console.log(
  `Unidades por condomínio: ${apartmentNumbers.length} (${apartmentNumbers[0]}–${apartmentNumbers.at(-1)})`,
);
if (dryRun) {
  console.log("Modo dry-run: nenhum dado será gravado.\n");
}

let totalCreated = 0;
let totalSkipped = 0;

for (const lookup of CONDOMINIUM_LOOKUP) {
  const condominium = await findCondominium(admin, lookup);
  if (!condominium) {
    console.error(`Condomínio não encontrado: ${lookup.label}`);
    process.exitCode = 1;
    continue;
  }

  const tower = dryRun
    ? { id: "(dry-run)", name: DEFAULT_TOWER_NAME }
    : await getOrCreateDefaultTower(admin, condominium.id);
  const block = condominium.name;
  const existingNumbers = dryRun
    ? new Set()
    : await listExistingUnitKeys(admin, tower.id, block);

  const toInsert = apartmentNumbers
    .filter((number) => !existingNumbers.has(number))
    .map((number) => ({
      tower_id: tower.id,
      number,
      block,
    }));

  console.log(
    `${condominium.name}: ${toInsert.length} novas, ${apartmentNumbers.length - toInsert.length} já existentes`,
  );

  if (dryRun) {
    totalCreated += toInsert.length;
    totalSkipped += apartmentNumbers.length - toInsert.length;
    continue;
  }

  for (let index = 0; index < toInsert.length; index += BATCH_SIZE) {
    const batch = toInsert.slice(index, index + BATCH_SIZE);
    const { error } = await admin.from("units").insert(batch);
    if (error) {
      console.error(`Erro ao inserir unidades em ${condominium.name}:`, error.message);
      process.exit(1);
    }
  }

  totalCreated += toInsert.length;
  totalSkipped += apartmentNumbers.length - toInsert.length;
}

console.log(`\nConcluído: ${totalCreated} criadas, ${totalSkipped} ignoradas (já cadastradas).`);
