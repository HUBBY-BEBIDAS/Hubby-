import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  city:  z.string().min(2).max(100).trim(),
  state: z.string().length(2).toUpperCase(),
});

/**
 * POST /api/waitlist
 * Registra interesse de um comprador em uma cidade ainda sem distribuidoras.
 * Usuário autenticado: vincula o client_id automaticamente.
 * Unauthenticated: salva só com e-mail (campo client_id é nullable no schema).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 422 }
    );
  }

  const { email, city, state } = parsed.data;

  // Tenta vincular ao cliente autenticado
  let clientId: string | null = null;
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const client = await prisma.client.findUnique({
      where:  { user_id: session.user.id },
      select: { id: true },
    });
    if (client) clientId = client.id;
  }

  try {
    await prisma.waitlist.upsert({
      where:  { email_city_state: { email, city, state } },
      update: { client_id: clientId ?? undefined },
      create: { email, city, state, client_id: clientId },
    });
  } catch {
    return Response.json({ error: "Erro ao registrar. Tente novamente." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
