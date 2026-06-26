import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async (_req: NextRequest, user) => {
    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true, plan: true },
    });

    if (!distributor) return Response.json({ error: "Perfil não encontrado" }, { status: 404 });
    if (distributor.plan !== "enterprise") return Response.json({ logs: [] });

    const logs = await prisma.webhookLog.findMany({
      where: { distributor_id: distributor.id },
      orderBy: { created_at: "desc" },
      take: 100,
      select: {
        id: true,
        event: true,
        url: true,
        status_code: true,
        success: true,
        error_message: true,
        created_at: true,
      },
    });

    return Response.json({ logs });
  },
  { roles: ["distributor_admin"] }
);
