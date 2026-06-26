import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/referrals/track
 *
 * Valida e retorna informações do código de indicação.
 * Chamado quando a distribuidora informa um código no cadastro (sem auth).
 *
 * Body: { code: string }
 * Returns: { valid, referrer_name }
 */
export async function POST(req: NextRequest) {
  let body: { code?: string };
  try { body = await req.json(); }
  catch { return Response.json({ error: "Body inválido" }, { status: 400 }); }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code || code.length < 4) {
    return Response.json({ valid: false, error: "Código inválido" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where:  { referral_code: code },
    select: { id: true, company_name: true, responsible_name: true },
  });

  if (!client) {
    return Response.json({ valid: false, error: "Código não encontrado" });
  }

  return Response.json({
    valid:         true,
    referrer_name: client.company_name || client.responsible_name,
  });
}
