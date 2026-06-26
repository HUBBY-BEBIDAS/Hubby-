import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/notifications
 *
 * Lista notificações in-app do usuário autenticado.
 * Disponível para todos os perfis (client, distributor_admin, distributor_collaborator).
 *
 * Query params:
 *   unread_only?: "true" | "false" (padrão "false")
 *   type?:        string — filtra por tipo (ex: "new_order", "new_credential_request", ...)
 *   page?:        number (padrão 1)
 *   limit?:       number (padrão 20, máx 50)
 *
 * ---
 *
 * PATCH /api/notifications
 *
 * Marca notificações como lidas.
 *
 * Body:
 *   ids: string[]  — lista de IDs a marcar; ou
 *   all: true      — marca todas as não lidas como lidas
 */

export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread_only") === "true";
  const typeFilter = searchParams.get("type") ?? "";
  const page  = Math.max(1, Number(searchParams.get("page")  ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const skip  = (page - 1) * limit;

  const where = {
    user_id: user.userId,
    ...(unreadOnly      ? { read: false }      : {}),
    ...(typeFilter      ? { type: typeFilter }  : {}),
  };

  const [notifications, total, unread_count] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        read: true,
        data: true,
        created_at: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { user_id: user.userId, read: false } }),
  ]);

  return Response.json({
    data: notifications,
    unread_count,
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  });
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (b.all === true) {
    const { count } = await prisma.notification.updateMany({
      where: { user_id: user.userId, read: false },
      data: { read: true },
    });
    return Response.json({ marked_read: count });
  }

  if (Array.isArray(b.ids) && b.ids.length > 0) {
    const ids = b.ids.filter((id): id is string => typeof id === "string");
    if (ids.length === 0) {
      return Response.json({ error: "ids deve conter strings" }, { status: 422 });
    }
    const { count } = await prisma.notification.updateMany({
      where: { user_id: user.userId, id: { in: ids } },
      data: { read: true },
    });
    return Response.json({ marked_read: count });
  }

  return Response.json(
    { error: "Forneça 'all: true' ou 'ids: string[]'" },
    { status: 422 }
  );
});
