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

  // Busca cidades distintas no banco (DeliveryRegion) por estado
  const rows = await prisma.deliveryRegion.findMany({
    where: {
      ...(state ? { state: { equals: state, mode: "insensitive" } } : {}),
    },
    select: { city: true, state: true },
    distinct: ["city", "state"],
    orderBy: [{ state: "asc" }, { city: "asc" }],
  });

  // Normaliza os nomes e filtra client-side usando correspondência sem acentos
  const qClean = q.length >= 2 ? normalizeCityName(q).toLowerCase() : "";
  const seen = new Set<string>();
  const cities: { city: string; state: string }[] = [];

  for (const r of rows) {
    const normalized = normalizeCityName(r.city);
    if (qClean && !normalized.toLowerCase().includes(qClean)) {
      continue;
    }
    const key = `${normalized}|${r.state.toUpperCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      cities.push({ city: normalized, state: r.state.toUpperCase() });
    }
  }

  // Retorna no máximo 20 resultados para o autocomplete
  return Response.json({ cities: cities.slice(0, 20) });
}
