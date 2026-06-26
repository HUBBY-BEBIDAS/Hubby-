import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async (_req: NextRequest) => {
    const entries = await prisma.waitlist.findMany({
      select: { city: true, state: true, email: true },
      orderBy: { created_at: "asc" },
    });

    const map = new Map<string, { city: string; state: string; emails: string[] }>();
    for (const e of entries) {
      const key = `${e.city.toLowerCase()}::${e.state.toUpperCase()}`;
      if (!map.has(key)) map.set(key, { city: e.city, state: e.state.toUpperCase(), emails: [] });
      map.get(key)!.emails.push(e.email);
    }

    const waitlist = [...map.values()]
      .map((g) => ({ city: g.city, state: g.state, count: g.emails.length, emails: g.emails }))
      .sort((a, b) => b.count - a.count);

    return Response.json({ waitlist, total: entries.length });
  },
  { roles: ["platform_admin"] }
);
