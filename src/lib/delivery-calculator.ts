/**
 * Cálculos de data de entrega — funções puras, sem I/O.
 *
 * Todas as datas são manipuladas em BRT (UTC-3) usando
 * métodos getUTC* sobre um Date ajustado ao offset brasileiro.
 */

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAYS_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/** Retorna o instante atual ajustado para BRT (UTC-3). */
export function getNowBRT(): Date {
  // Date.now() é UTC. Subtraímos 3h para obter o horário de Brasília.
  // Usamos getUTC* neste objeto para extrair hora/dia no fuso brasileiro.
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

/** Verifica se o horário de corte já passou em relação a `now` (BRT). */
function isCutoffPassed(now: Date, cutoffTime: string): boolean {
  const [cutH, cutM] = cutoffTime.split(":").map(Number);
  const nowH = now.getUTCHours();
  const nowM = now.getUTCMinutes();
  return nowH > cutH || (nowH === cutH && nowM >= cutM);
}

/**
 * Encontra o próximo dia de rota a partir de `now`.
 *
 * - Se cutoff NÃO passou: inclui hoje na busca (pode ser hoje mesmo)
 * - Se cutoff JÁ passou:  começa a busca a partir de amanhã
 */
function findNextRouteDate(
  now: Date,
  routeDays: string[],
  cutoffPassed: boolean
): Date {
  const todayIndex = now.getUTCDay(); // 0=Dom … 6=Sáb em BRT
  const startFrom = cutoffPassed ? (todayIndex + 1) % 7 : todayIndex;
  const routeIndices = new Set(routeDays.map((d) => DAY_NAME_TO_INDEX[d] ?? -1));

  for (let offset = 0; offset <= 7; offset++) {
    const checkDay = (startFrom + offset) % 7;
    if (routeIndices.has(checkDay)) {
      // daysFromToday: 1 base (amanhã) quando cutoff passou, 0 (hoje) quando não
      const daysFromToday = (cutoffPassed ? 1 : 0) + offset;
      const result = new Date(now);
      result.setUTCDate(result.getUTCDate() + daysFromToday);
      result.setUTCHours(0, 0, 0, 0);
      return result;
    }
  }

  // Nunca deve ocorrer se routeDays não for vazio
  throw new Error("Nenhum dia de rota encontrado em routeDays");
}

/**
 * Soma `days` dias úteis a partir do dia seguinte ao `startDate`.
 * Ignora sábado (6) e domingo (0).
 * Feriados nacionais não são descontados no MVP.
 */
function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const dow = result.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/**
 * Conta dias úteis entre `from` (exclusive) e `to` (inclusive).
 * Usado para comparar com max_delivery_days do cliente.
 */
export function countBusinessDaysFromNow(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setUTCDate(cursor.getUTCDate() + 1); // começa no dia seguinte
  cursor.setUTCHours(0, 0, 0, 0);

  const target = new Date(to);
  target.setUTCHours(0, 0, 0, 0);

  while (cursor <= target) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/** Formata a data de entrega no padrão "quarta-feira, 09/07". */
export function formatDeliveryDate(date: Date): string {
  const dayName = DAYS_PT[date.getUTCDay()];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dayName}, ${day}/${month}`;
}

// ─── API pública ─────────────────────────────────────────────────────────────

export type DeliveryEstimate = {
  routeDate: Date;
  deliveryDate: Date;
  deliveryDateFormatted: string; // "quarta-feira, 09/07"
  totalBusinessDays: number;     // dias úteis de hoje até a entrega
};

/**
 * Calcula a data de entrega para uma região, a partir de `now` (BRT).
 *
 * @param now       Instante atual em BRT (use getNowBRT())
 * @param region    Região de entrega da distribuidora
 */
export function calculateDeliveryEstimate(
  now: Date,
  region: {
    route_days: string[];
    cutoff_time: string;
    delivery_days_business: number;
  }
): DeliveryEstimate {
  const cutoffPassed = isCutoffPassed(now, region.cutoff_time);
  const routeDate = findNextRouteDate(now, region.route_days, cutoffPassed);
  const deliveryDate = addBusinessDays(routeDate, region.delivery_days_business);
  const totalBusinessDays = countBusinessDaysFromNow(now, deliveryDate);

  return {
    routeDate,
    deliveryDate,
    deliveryDateFormatted: formatDeliveryDate(deliveryDate),
    totalBusinessDays,
  };
}
