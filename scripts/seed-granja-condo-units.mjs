/**
 * Cadastra unidades 101–706 (7 andares × 6 aptos) nos condomínios Bromélias,
 * Orquídeas e Quaresmas.
 *
 * Opção A — Supabase SQL Editor (recomendado se não tiver .env.local):
 *   Abra scripts/seed-granja-condo-units.sql e execute no SQL Editor.
 *
 * Opção B — Terminal do projeto (requer .env.local):
 *   node scripts/seed-granja-condo-units.mjs
 *   node scripts/seed-granja-condo-units.mjs --dry-run
 *
 * Requer .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const CONDOMINIUM_LOOKUP = [
  { label: "Bromélias", patterns: ["bromélia", "bromelia"], floors: 7, apartmentsPerFloor: 6 },
  { label: "Orquídeas", patterns: ["orquídea", "orquidea"], floors: 7, apartmentsPerFloor: 6 },
  { label: "Quaresmas", patterns: ["quaresma"], floors: 7, apartmentsPerFloor: 6 },
  { label: "Figueiras", patterns: ["figueira"], floors: 7, apartmentsPerFloor: 4 },
  { label: "Jacarandás", patterns: ["jacaranda"], floors: 3, apartmentsPerFloor: 4 },
  { label: "Jequitibás", patterns: ["jequitiba"], floors: 3, apartmentsPerFloor: 4 },
  { label: "Cambucás", patterns: ["cambuca"], floors: 4, apartmentsPerFloor: 4 },
  { label: "Jabuticabeiras", patterns: ["jabuticabeira"], floors: 4, apartmentsPerFloor: 4 },
  { label: "Palmeiras", patterns: ["palmeira"], floors: 4, apartmentsPerFloor: 12 },
  {
    label: "Acácias",
    patterns: ["acácia", "acacia"],
    floors: 4,
    apartmentsPerFloor: 2,
  },
  {
    label: "Bouganville",
    patterns: ["bouganville", "buganville", "bougainville"],
    floors: 4,
    apartmentsPerFloor: 2,
  },
  { label: "Cerejeiras", patterns: ["cerejeira"], floors: 4, apartmentsPerFloor: 2 },
  { label: "Pau Brasil", patterns: ["pau brasil"], floors: 7, apartmentsPerFloor: 8 },
  { label: "Magnólias", patterns: ["magnólia", "magnolia"], floors: 7, apartmentsPerFloor: 2 },
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

function generateApartmentNumbers(floors, apartmentsPerFloor) {
  const numbers = [];
  for (let floor = 1; floor <= floors; floor += 1) {
    for (let apartment = 1; apartment <= apartmentsPerFloor; apartment += 1) {
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

async function getOrCreateDefaultTower(admin, condominiumId, floors) {
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
      floors,
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
const onlyNeedles = process.argv
  .filter((arg) => arg.startsWith("--only="))
  .flatMap((arg) => arg.slice("--only=".length).split(","))
  .map((value) => normalize(value.trim()))
  .filter(Boolean);
const selectedLookups =
  onlyNeedles.length > 0
    ? CONDOMINIUM_LOOKUP.filter((lookup) =>
        onlyNeedles.some(
          (needle) =>
            normalize(lookup.label).includes(needle) ||
            lookup.patterns.some((pattern) => normalize(pattern).includes(needle)),
        ),
      )
    : CONDOMINIUM_LOOKUP;

if (onlyNeedles.length > 0 && selectedLookups.length === 0) {
  console.error(`Nenhum condomínio encontrado para --only=${onlyNeedles.join(",")}`);
  process.exit(1);
}
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

if (dryRun) {
  console.log("Modo dry-run: nenhum dado será gravado.\n");
}

let totalCreated = 0;
let totalSkipped = 0;

for (const lookup of selectedLookups) {
  const apartmentNumbers = generateApartmentNumbers(
    lookup.floors,
    lookup.apartmentsPerFloor,
  );
  const condominium = await findCondominium(admin, lookup);
  if (!condominium) {
    console.error(`Condomínio não encontrado: ${lookup.label}`);
    process.exitCode = 1;
    continue;
  }

  const tower = dryRun
    ? { id: "(dry-run)", name: DEFAULT_TOWER_NAME }
    : await getOrCreateDefaultTower(admin, condominium.id, lookup.floors);
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
    `${condominium.name}: ${toInsert.length} novas, ${apartmentNumbers.length - toInsert.length} já existentes (${apartmentNumbers[0]}–${apartmentNumbers.at(-1)})`,
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
