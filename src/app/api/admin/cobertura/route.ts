import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/cobertura
 * Lista todas as cidades de cobertura com contagem de espera por cidade.
 *
 * POST /api/admin/cobertura
 * Adiciona nova cidade à cobertura.
 */

export const GET = withAuth(
  async () => {
    const [cities, waitlistGroups] = await Promise.all([
      prisma.coverageCity.findMany({
        orderBy: [{ state: "asc" }, { city: "asc" }],
      }),
      prisma.waitlist.groupBy({
        by: ["city", "state"],
        _count: { id: true },
      }),
    ]);

    const waitlistMap = new Map(
      waitlistGroups.map((g) => [`${g.city.toLowerCase()}|${g.state.toUpperCase()}`, g._count.id])
    );

    return Response.json(
      cities.map((c) => ({
        ...c,
        waitlist_count: waitlistMap.get(`${c.city.toLowerCase()}|${c.state.toUpperCase()}`) ?? 0,
      }))
    );
  },
  { roles: ["platform_admin"] }
);

const addSchema = z.object({
  city:   z.string().min(2).trim(),
  state:  z.string().length(2).transform((v) => v.toUpperCase()),
  active: z.boolean().default(true),
});

export const POST = withAuth(
  async (req: NextRequest) => {
    let body: unknown;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
    }

    const { city, state, active } = parsed.data;

    const created = await prisma.coverageCity.upsert({
      where: { city_state: { city, state } },
      create: { city, state, active },
      update: { active },
    });

    return Response.json(created, { status: 201 });
  },
  { roles: ["platform_admin"] }
);
