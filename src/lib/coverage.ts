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
 *   city (padrão)    → verifica no banco (CoverageCity.active); fallback env var
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

  const stateUp  = state.toUpperCase().trim();
  const cityClean = cleanString(city);

  if (COVERAGE_MODE === "state") {
    return stateUp === COVERAGE_STATE;
  }

  // city mode: DB tem prioridade (busca todas as cidades do estado e compara normalizado)
  const dbCities = await prisma.coverageCity.findMany({
    where: { state: stateUp },
    select: { city: true, active: true },
  });

  const matched = dbCities.find((c) => cleanString(c.city) === cityClean);
  if (matched !== undefined) return matched.active;

  // fallback → env var (compara normalizado)
  const fallbackCities = COVERAGE_CITIES.map(cleanString);
  return stateUp === COVERAGE_STATE && fallbackCities.includes(cityClean);
}
