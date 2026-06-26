import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EstablishmentType } from "@prisma/client";
import { queryBureau, evaluateHubbyEntry, HUBBY_REJECTION_MESSAGE } from "@/lib/bureau";
import { isCovered } from "@/lib/coverage";
import { ensureUniqueCode } from "@/lib/referral";
import { checkLoginRateLimit } from "@/lib/rate-limit";

const cnpjField = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(
    z.string()
      .length(14, "CNPJ deve ter 14 dígitos — verifique e tente novamente")
      .regex(/^\d+$/, "CNPJ inválido")
  );

const baseSchema = z.object({
  email: z.string().email("E-mail inválido").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula (ex: Senha123)")
    .regex(/[0-9]/, "Senha deve conter ao menos um número (ex: Senha123)"),
  responsible_name: z.string().min(2, "Nome do responsável é obrigatório").trim(),
  company_name: z.string().min(2, "Nome da empresa é obrigatório").trim(),
  cnpj: cnpjField,
});

const whatsappField = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(
    z.string()
      .min(10, "WhatsApp inválido — informe DDD + número (ex: 11999998888)")
      .max(11, "WhatsApp inválido — máximo 11 dígitos")
      .regex(/^\d+$/, "WhatsApp inválido")
  );

const clientSchema = baseSchema.extend({
  role: z.literal("client"),
  whatsapp: whatsappField,
  establishment_type: z.enum([
    "bar", "restaurant", "adega", "hotel", "nightclub",
    "supermarket", "convenience", "other",
  ]),
  delivery_city: z.string().min(2, "Cidade de entrega é obrigatória").trim(),
  delivery_state: z
    .string()
    .transform((v) => v.toUpperCase().trim())
    .pipe(z.string().length(2, "UF deve ter exatamente 2 letras (ex: SP)")),
});

const distributorSchema = baseSchema.extend({
  role: z.literal("distributor_admin"),
  whatsapp_commercial: whatsappField,
  referral_code: z.string().min(4).max(10).trim().toUpperCase().optional(),
});

const registerSchema = z.discriminatedUnion("role", [clientSchema, distributorSchema]);

export async function POST(req: NextRequest) {
  try {
    // Rate limiting — mesmo padrão do login: 5 tentativas / 15 min por IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl  = await checkLoginRateLimit(ip);
    if (!rl.allowed) {
      return Response.json(
        { error: `Muitas tentativas de cadastro. Aguarde ${rl.retryAfterSeconds} segundos.` },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body inválido" }, { status: 400 });
    }

    console.log("[register] body recebido:", JSON.stringify(body));

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      console.log("[register] erro de validação:", JSON.stringify(fieldErrors));

      // Retorna a primeira mensagem de erro em ordem de prioridade dos campos
      const fieldOrder = [
        "role", "email", "password", "responsible_name", "company_name",
        "cnpj", "whatsapp", "whatsapp_commercial",
        "establishment_type", "delivery_city", "delivery_state",
      ];
      let firstError: string | undefined;
      for (const field of fieldOrder) {
        const msgs = fieldErrors[field as keyof typeof fieldErrors];
        if (msgs && msgs.length > 0) {
          firstError = msgs[0];
          break;
        }
      }
      // Fallback: qualquer outro campo
      if (!firstError) {
        const anyField = Object.values(fieldErrors).find((v) => v && v.length > 0);
        firstError = anyField?.[0];
      }

      return Response.json(
        { error: firstError ?? "Dados inválidos. Verifique os campos e tente novamente." },
        { status: 422 }
      );
    }

    const d = parsed.data;

    const existingEmail = await prisma.user.findUnique({ where: { email: d.email } });
    if (existingEmail) {
      console.log("[register] 409 — email já cadastrado:", d.email);
      return Response.json(
        { error: "Este e-mail já está cadastrado. Faça login ou use outro e-mail." },
        { status: 409 }
      );
    }

    const existingCnpj =
      d.role === "client"
        ? await prisma.client.findUnique({ where: { cnpj: d.cnpj } })
        : await prisma.distributor.findUnique({ where: { cnpj: d.cnpj } });

    if (existingCnpj) {
      console.log("[register] 409 — CNPJ já cadastrado:", d.cnpj, "role:", d.role);
      return Response.json(
        { error: "Este CNPJ já está cadastrado na plataforma." },
        { status: 409 }
      );
    }

    const password_hash = await bcrypt.hash(d.password, 12);

    if (d.role === "client") {
      // ─── Critério de entrada Hubby ─────────────────────────────────────────
      let hubbyStatus: "approved_clean" | "approved_with_warning" = "approved_clean";
      try {
        const bureau = await queryBureau(d.cnpj);
        const entry = evaluateHubbyEntry(bureau);
        if (entry.outcome === "rejected") {
          console.log(`[register] Hubby entry rejected — cnpj=${d.cnpj} reason=${entry.reason}`);
          return Response.json({ error: HUBBY_REJECTION_MESSAGE }, { status: 422 });
        }
        hubbyStatus = entry.outcome;
      } catch (bureauErr) {
        // Bureau indisponível → permite o cadastro sem bloquear
        console.warn("[register] bureau indisponível, continuando sem validação:", bureauErr);
      }

      const referralCode = await ensureUniqueCode();

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: d.email,
            password_hash,
            provider: "credentials",
            role: "client",
          },
        });

        await tx.client.create({
          data: {
            user_id: user.id,
            company_name: d.company_name,
            cnpj: d.cnpj,
            establishment_type: d.establishment_type as EstablishmentType,
            responsible_name: d.responsible_name,
            whatsapp: d.whatsapp,
            delivery_city: d.delivery_city,
            delivery_state: d.delivery_state,
            delivery_address_full: `${d.delivery_city} - ${d.delivery_state}`,
            hubby_status: hubbyStatus,
            hubby_score: 500,
            referral_code: referralCode,
          },
        });
      });
    } else {
      // Valida código de indicação se fornecido
      let referrerClientId: string | null = null;
      if (d.referral_code) {
        const referrer = await prisma.client.findUnique({
          where:  { referral_code: d.referral_code },
          select: { id: true },
        });
        if (!referrer) {
          return Response.json({ error: "Código de indicação inválido ou não encontrado." }, { status: 422 });
        }
        referrerClientId = referrer.id;
      }

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: d.email,
            password_hash,
            provider: "credentials",
            role: "distributor_admin",
          },
        });

        const dist = await tx.distributor.create({
          data: {
            user_id: user.id,
            company_name: d.company_name,
            cnpj: d.cnpj,
            whatsapp_commercial: d.whatsapp_commercial,
            email_commercial: d.email,
            ...(d.referral_code && { referral_code_used: d.referral_code }),
          },
        });

        // Cria registro de indicação com status pendente
        if (referrerClientId) {
          await tx.referral.create({
            data: {
              referrer_id:             referrerClientId,
              referred_distributor_id: dist.id,
              referral_code:           d.referral_code!,
              status:                  "pending",
            },
          });
        }
      });
    }

    // Coverage check (clients only) — add to waitlist if outside coverage
    let coverage_warning = false;
    if (d.role === "client") {
      const covered = await isCovered(d.delivery_city, d.delivery_state).catch(() => true);
      if (!covered) {
        coverage_warning = true;
        await prisma.waitlist.upsert({
          where: { email_city_state: { email: d.email, city: d.delivery_city, state: d.delivery_state } },
          create: { email: d.email, city: d.delivery_city, state: d.delivery_state },
          update: {},
        }).catch(() => {}); // ignore if already on waitlist
      }
    }

    return Response.json({ ok: true, coverage_warning }, { status: 201 });
  } catch (err: unknown) {
    const prismaCode = (err as { code?: string })?.code;
    const meta = (err as { meta?: { target?: string[] } })?.meta;
    console.error("[register] erro inesperado — code:", prismaCode, "meta:", JSON.stringify(meta), "err:", err);

    if (prismaCode === "P2002") {
      const field = meta?.target?.[0] ?? "campo";
      const fieldLabel =
        field === "email" ? "e-mail" :
        field === "cnpj"  ? "CNPJ"  : field;
      return Response.json(
        { error: `Este ${fieldLabel} já está cadastrado na plataforma.` },
        { status: 409 }
      );
    }

    return Response.json({ error: "Erro interno ao criar conta. Tente novamente." }, { status: 500 });
  }
}
