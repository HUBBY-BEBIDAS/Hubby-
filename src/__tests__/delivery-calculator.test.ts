/**
 * Testes unitários do motor de cálculo de datas de entrega.
 *
 * Convenção: todas as datas são passadas já no fuso BRT (UTC-3),
 * representadas internamente como UTC (pois getNowBRT faz o ajuste).
 * Usamos getUTC* para inspecionar os resultados.
 */

import {
  calculateDeliveryEstimate,
  countBusinessDaysFromNow,
  formatDeliveryDate,
} from "@/lib/delivery-calculator";

// Helper: cria um Date em BRT para os testes
// Ex: makeBRT(2026, 4, 8, 14, 0) = quarta-feira 14h BRT
function makeBRT(
  year: number,
  month: number, // 1-based
  day: number,
  hour = 0,
  minute = 0
): Date {
  // Cria em UTC, depois subtrai 3h para simular getNowBRT()
  const utc = Date.UTC(year, month - 1, day, hour + 3, minute); // +3h para compensar -3h do BRT
  return new Date(utc - 3 * 60 * 60 * 1000);
}

// ─── countBusinessDaysFromNow ─────────────────────────────────────────────────

describe("countBusinessDaysFromNow", () => {
  test("mesmo dia → 0 dias úteis", () => {
    const now = makeBRT(2026, 4, 8, 14, 0); // quarta
    const target = makeBRT(2026, 4, 8, 23, 59);
    expect(countBusinessDaysFromNow(now, target)).toBe(0);
  });

  test("dia seguinte em semana → 1 dia útil", () => {
    const now = makeBRT(2026, 4, 8); // quarta
    const target = makeBRT(2026, 4, 9); // quinta
    expect(countBusinessDaysFromNow(now, target)).toBe(1);
  });

  test("sexta → segunda ignora fim de semana", () => {
    const now = makeBRT(2026, 4, 10); // sexta
    const target = makeBRT(2026, 4, 13); // segunda
    expect(countBusinessDaysFromNow(now, target)).toBe(1);
  });

  test("quinta → terça = 3 dias úteis (pula fim de semana)", () => {
    const now = makeBRT(2026, 4, 9); // quinta
    const target = makeBRT(2026, 4, 14); // terça
    expect(countBusinessDaysFromNow(now, target)).toBe(3); // sex + seg + ter
  });
});

// ─── calculateDeliveryEstimate ────────────────────────────────────────────────

const baseRegion = {
  route_days: ["monday", "wednesday", "friday"],
  cutoff_time: "15:00",
  delivery_days_business: 2,
};

describe("calculateDeliveryEstimate — cutoff não passou", () => {
  test("hoje é dia de rota e cutoff não passou → rota hoje, entrega em 2 dias úteis", () => {
    // Quarta-feira 14h — dentro do prazo de corte
    const now = makeBRT(2026, 4, 8, 14, 0); // quarta (2026-04-08)
    const result = calculateDeliveryEstimate(now, baseRegion);

    // Rota = hoje (quarta 08/04)
    expect(result.routeDate.getUTCDay()).toBe(3); // 3 = quarta
    // Entrega = hoje + 2 dias úteis = sexta 10/04
    expect(result.deliveryDate.getUTCDay()).toBe(5); // 5 = sexta
    // Dias úteis de hoje (quarta) até sexta: qui=1, sex=2
    expect(result.totalBusinessDays).toBe(2);
  });

  test("hoje é quinta, cutoff não passou → próxima rota é sexta", () => {
    const now = makeBRT(2026, 4, 9, 10, 0); // quinta 10h
    const result = calculateDeliveryEstimate(now, baseRegion);

    // Rota = sexta 10/04
    expect(result.routeDate.getUTCDay()).toBe(5);
    // Entrega = sexta + 2 du = terça 14/04 (pula sáb+dom → seg=1, ter=2)
    expect(result.deliveryDate.getUTCDay()).toBe(2); // terça
    // Dias úteis de quinta até terça: sex=1, seg=2, ter=3
    expect(result.totalBusinessDays).toBe(3);
  });
});

describe("calculateDeliveryEstimate — cutoff passou", () => {
  test("hoje é dia de rota mas cutoff passou → rota na próxima sexta", () => {
    // Quarta 16h — passou o corte de 15:00
    const now = makeBRT(2026, 4, 8, 16, 0); // quarta
    const result = calculateDeliveryEstimate(now, baseRegion);

    // Rota = sexta 10/04 (próxima após quarta com cutoff passado)
    expect(result.routeDate.getUTCDay()).toBe(5);
    // Entrega = sexta + 2 du = terça 14/04
    expect(result.deliveryDate.getUTCDay()).toBe(2);
    // Dias úteis de quarta até terça: qui=1, sex=2, seg=3, ter=4
    expect(result.totalBusinessDays).toBe(4);
  });

  test("sexta com cutoff passado → próxima rota é segunda da semana seguinte", () => {
    const now = makeBRT(2026, 4, 10, 16, 30); // sexta 16:30
    const result = calculateDeliveryEstimate(now, baseRegion);

    // Rota = próxima segunda 13/04
    expect(result.routeDate.getUTCDay()).toBe(1); // segunda
    // Entrega = segunda + 2 du = quarta 15/04
    expect(result.deliveryDate.getUTCDay()).toBe(3); // quarta
    // Dias úteis de sexta até quarta: seg=1, ter=2, qua=3
    expect(result.totalBusinessDays).toBe(3);
  });
});

describe("calculateDeliveryEstimate — delivery_days_business = 1", () => {
  test("rota na quinta, entrega na sexta (1 du)", () => {
    const region = { ...baseRegion, route_days: ["thursday"], delivery_days_business: 1 };
    const now = makeBRT(2026, 4, 8, 10, 0); // quarta 10h
    const result = calculateDeliveryEstimate(now, region);

    expect(result.routeDate.getUTCDay()).toBe(4); // quinta
    expect(result.deliveryDate.getUTCDay()).toBe(5); // sexta
    expect(result.totalBusinessDays).toBe(2); // qui=1, sex=2
  });
});

// ─── formatDeliveryDate ───────────────────────────────────────────────────────

describe("formatDeliveryDate", () => {
  test("formata quarta corretamente", () => {
    const date = makeBRT(2026, 7, 8, 0, 0); // 08/07/2026 - quarta-feira
    expect(formatDeliveryDate(date)).toBe("quarta-feira, 08/07");
  });

  test("formata segunda corretamente", () => {
    const date = makeBRT(2026, 4, 13, 0, 0); // 13/04 - segunda
    expect(formatDeliveryDate(date)).toBe("segunda-feira, 13/04");
  });
});
