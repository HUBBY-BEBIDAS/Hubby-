import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/** GET /api/wishlist — lista os produtos salvos do comprador. */
export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const client = await prisma.client.findUnique({
      where:  { user_id: user.userId },
      select: { id: true },
    });
    if (!client) return Response.json({ items: [] });

    const items = await prisma.wishlistItem.findMany({
      where:   { client_id: client.id },
      orderBy: { created_at: "desc" },
    });

    return Response.json({ items });
  },
  { roles: ["client"] }
);
