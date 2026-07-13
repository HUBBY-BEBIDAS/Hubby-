import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCityName } from "@/lib/coverage";

/**
 * GET /api/coverage/cities?q=santo&state=SP
 *
 * Retorna cidades distintas que possuem ao menos uma DeliveryRegion cadastrada.
 * Usado pelo CityAutocomplete no cadastro e edição de perfil.
 * Endpoint público — não requer autenticação.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q     = searchParams.get("q")?.trim() ?? "";
  const state = searchParams.get("state")?.trim().toUpperCase() ?? "";

  // Busca cidades distintas no banco (DeliveryRegion)
  const rows = await prisma.deliveryRegion.findMany({
    where: {
      ...(state  ? { state: { equals: state, mode: "insensitive" } } : {}),
      ...(q.length >= 2
        ? { city: { contains: q, mode: "insensitive" } }
        : {}),
    },
    select: { city: true, state: true },
    distinct: ["city", "state"],
    orderBy: [{ state: "asc" }, { city: "asc" }],
    take: 20,
  });

  // Normaliza os nomes e remove duplicatas residuais (diferença de acentuação, etc.)
  const seen = new Set<string>();
  const cities: { city: string; state: string }[] = [];

  for (const r of rows) {
    const normalized = normalizeCityName(r.city);
    const key = `${normalized}|${r.state.toUpperCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      cities.push({ city: normalized, state: r.state.toUpperCase() });
    }
  }

  return Response.json({ cities });
}
