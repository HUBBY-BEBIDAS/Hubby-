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
export async function isCovered(city: string, state: string): Promise<boolean> {
  if (COVERAGE_MODE === "national" || COVERAGE_MODE === "latam") return true;

  const stateUp  = state.toUpperCase();
  const cityLow  = city.trim().toLowerCase();

  if (COVERAGE_MODE === "state") {
    return stateUp === COVERAGE_STATE;
  }

  // city mode: DB tem prioridade
  const dbEntry = await prisma.coverageCity.findFirst({
    where: {
      city:  { equals: city.trim(), mode: "insensitive" },
      state: { equals: stateUp,     mode: "insensitive" },
    },
    select: { active: true },
  });

  if (dbEntry !== null) return dbEntry.active;

  // fallback → env var
  return stateUp === COVERAGE_STATE &&
    COVERAGE_CITIES.some((c) => c === cityLow);
}
