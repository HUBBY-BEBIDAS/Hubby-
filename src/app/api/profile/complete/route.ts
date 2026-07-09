import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { normalizeCityName } from "@/lib/coverage";

const schema = z.object({
  company_name: z.string().min(2, "Razão social obrigatória").trim(),
  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, "")) // aceita com ou sem máscara
    .pipe(
      z
        .string()
        .length(14, "CNPJ deve ter 14 dígitos")
        .regex(/^\d+$/, "CNPJ deve conter apenas números")
    ),
  establishment_type: z.enum([
    "bar", "restaurant", "adega", "hotel", "nightclub",
    "supermarket", "convenience", "other",
  ]),
  responsible_name: z.string().min(2, "Nome do responsável obrigatório").trim(),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, "")) // aceita com ou sem máscara
    .pipe(
      z
        .string()
        .min(10, "WhatsApp inválido")
        .max(11, "WhatsApp inválido")
        .regex(/^\d+$/, "WhatsApp deve conter apenas números")
    ),
  delivery_city: z.string().min(2, "Cidade obrigatória").trim(),
  delivery_state: z.string().length(2, "UF deve ter 2 letras").toUpperCase(),
  delivery_address_full: z.string().min(5, "Endereço obrigatório").trim(),
});

export const POST = withAuth(
  async (req: NextRequest, user) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const d = parsed.data;

    // Idempotente: se o cliente já existe para este usuário, apenas retorna ok
    const alreadyExists = await prisma.client.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (alreadyExists) {
      return Response.json({ ok: true }, { status: 200 });
    }

    // Garante CNPJ único globalmente
    const cnpjTaken = await prisma.client.findUnique({ where: { cnpj: d.cnpj } });
    if (cnpjTaken) {
      return Response.json({ error: "Este CNPJ já está cadastrado" }, { status: 409 });
    }

    // Busca o e-mail do usuário para registrar o owner no time
    const userRecord = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });

    const client = await prisma.client.create({
      data: {
        user_id: user.userId,
        company_name: d.company_name,
        cnpj: d.cnpj,
        establishment_type: d.establishment_type,
        responsible_name: d.responsible_name,
        whatsapp: d.whatsapp,
        delivery_city: normalizeCityName(d.delivery_city),
        delivery_state: d.delivery_state,
        delivery_address_full: d.delivery_address_full,
      },
    });

    // Cria o registro de owner no time automaticamente
    if (userRecord) {
      await prisma.clientMember.create({
        data: {
          client_id: client.id,
          user_id: user.userId,
          email: userRecord.email,
          role: "owner",
          status: "active",
          accepted_at: new Date(),
        },
      });
    }

    return Response.json({ ok: true }, { status: 201 });
  },
  { roles: ["client"] }
);
