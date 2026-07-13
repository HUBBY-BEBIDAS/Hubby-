import { prisma } from "@/lib/prisma";

const COVERAGE_MODE   = (process.env.COVERAGE_MODE  ?? "city").toLowerCase();
const COVERAGE_STATE  = (process.env.COVERAGE_STATE ?? "SP").toUpperCase();
const COVERAGE_CITIES = (process.env.COVERAGE_CITIES ?? "São Paulo")
  .split(",")
  .map((c) => c.trim().toLowerCase());

/**
 * Verifica se uma cidade/estado está dentro da cobertura atual da Hubby.
 *
 * Lógica:
 *   national / latam → sempre coberto
 *   state            → verifica apenas o estado (COVERAGE_STATE)
 *   city (padrão)    → verifica no banco de duas formas:
 *     1. DeliveryRegion: se houver ao menos uma distribuidora entregando na cidade → coberto
 *     2. CoverageCity: lista manual de controle (fallback/override)
 *     3. Env var COVERAGE_CITIES (último recurso)
 */
export function normalizeCityName(city: string): string {
  if (!city) return "";
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanString(str: string): string {
  return normalizeCityName(str).toLowerCase();
}

export async function isCovered(city: string, state: string): Promise<boolean> {
  if (COVERAGE_MODE === "national" || COVERAGE_MODE === "latam") return true;

  const stateUp   = state.toUpperCase().trim();
  const cityClean = cleanString(city);

  if (COVERAGE_MODE === "state") {
    return stateUp === COVERAGE_STATE;
  }

  // 1. Fonte primária: existe alguma DeliveryRegion ativa para essa cidade?
  //    Qualquer cidade onde uma distribuidora entrega é automaticamente coberta.
  const stateRegions = await prisma.deliveryRegion.findMany({
    where: {
      state: { equals: stateUp, mode: "insensitive" },
    },
    select: { city: true },
  });

  const hasMatchingRegion = stateRegions.some(
    (r) => cleanString(r.city) === cityClean
  );

  if (hasMatchingRegion) return true;

  // 2. Fonte secundária: CoverageCity manual (pode bloquear explicitamente com active=false)
  const dbCities = await prisma.coverageCity.findMany({
    where: { state: stateUp },
    select: { city: true, active: true },
  });

  const matched = dbCities.find((c) => cleanString(c.city) === cityClean);
  if (matched !== undefined) return matched.active;

  // 3. Fallback → env var COVERAGE_CITIES
  const fallbackCities = COVERAGE_CITIES.map(cleanString);
  return stateUp === COVERAGE_STATE && fallbackCities.includes(cityClean);
}
