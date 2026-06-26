import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/** POST /api/billing/portal — cria sessão do Customer Portal do Stripe e retorna a URL. */
export const POST = withAuth(
  async (_req: NextRequest, user) => {
    let customerId: string | null = null;

    if (user.role === "client") {
      const client = await prisma.client.findUnique({
        where:  { user_id: user.userId },
        select: { stripe_customer_id: true },
      });
      customerId = client?.stripe_customer_id ?? null;
    } else if (user.role === "distributor_admin") {
      const dist = await prisma.distributor.findUnique({
        where:  { user_id: user.userId },
        select: { stripe_customer_id: true },
      });
      customerId = dist?.stripe_customer_id ?? null;
    }

    if (!customerId) {
      return Response.json(
        { error: "Nenhuma assinatura ativa encontrada para gerenciar." },
        { status: 404 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${APP_URL}/meu-plano`,
    });

    return Response.json({ url: session.url });
  },
  { roles: ["client", "distributor_admin"] }
);
