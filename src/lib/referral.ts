import { prisma } from "@/lib/prisma";

// Caracteres sem ambiguidade (sem I/O/0/1)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** Gera código único para o cliente, tentando até 10x em caso de colisão. */
export async function ensureUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateReferralCode();
    const exists = await prisma.client.findUnique({
      where: { referral_code: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  // Fallback improvável: adiciona timestamp suffix
  return `${generateReferralCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}

/** Tabela de recompensas escalonada por conversão (0-indexed: 0 = 1ª conversão). */
export function rewardDays(previousConversions: number): number {
  if (previousConversions === 0) return 30;
  if (previousConversions === 1) return 60;
  if (previousConversions === 2) return 90;
  return 30; // 4ª conversão em diante
}

/**
 * Aplica a recompensa de indicação ao cliente.
 * - Estende pro_expires_at pelo número de dias
 * - Marca como embaixador na 3ª conversão
 * - Atualiza o Referral como convertido
 */
export async function applyReferralReward(referralId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: { referrer: true },
  });

  if (!referral || referral.status !== "pending") return;

  const previousConverted = await prisma.referral.count({
    where: { referrer_id: referral.referrer_id, status: "converted" },
  });

  const days = rewardDays(previousConverted);
  const now  = new Date();

  // Calcula nova data de expiração do Pro
  const currentExpiry = referral.referrer.pro_expires_at;
  const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  const isThirdConversion = previousConverted === 2;

  await prisma.$transaction([
    // Atualiza o referral como convertido
    prisma.referral.update({
      where: { id: referralId },
      data: {
        status:             "converted",
        reward_days_granted: days,
        converted_at:       now,
      },
    }),
    // Aplica recompensa ao cliente
    prisma.client.update({
      where: { id: referral.referrer_id },
      data: {
        client_plan:        "pro",
        client_plan_status: "active",
        pro_expires_at:     newExpiry,
        ...(isThirdConversion && { is_ambassador: true }),
      },
    }),
  ]);

  console.log(
    `[referral] recompensa aplicada: referral=${referralId} days=${days} ` +
    `client=${referral.referrer_id} expiry=${newExpiry.toISOString()} ambassador=${isThirdConversion}`
  );
}
