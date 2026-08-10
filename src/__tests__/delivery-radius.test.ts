/**
 * Testes unitários para o cálculo de distância (Haversine) e validação do Raio Máximo de Entrega.
 */

import { calcDistanceKm } from "@/lib/ranking-engine";

describe("calcDistanceKm — Fórmula de Haversine", () => {
  // Coordenadas aproximadas em São Paulo / SP
  const distCenter = { lat: -23.55052, lng: -46.633308 }; // Praça da Sé (Centro SP)
  const clientPinheiros = { lat: -23.56168, lng: -46.69055 }; // Pinheiros (~6km)
  const clientGuarulhos = { lat: -23.46278, lng: -46.53333 }; // Guarulhos (~14km)
  const clientCampinas = { lat: -22.90556, lng: -47.06083 }; // Campinas (~85km)

  test("calcula a distância corretamente entre dois pontos próximos", () => {
    const dist = calcDistanceKm(distCenter.lat, distCenter.lng, clientPinheiros.lat, clientPinheiros.lng);
    expect(dist).toBeGreaterThan(5);
    expect(dist).toBeLessThan(7);
  });

  test("calcula distância para cidade vizinha da região metropolitana", () => {
    const dist = calcDistanceKm(distCenter.lat, distCenter.lng, clientGuarulhos.lat, clientGuarulhos.lng);
    expect(dist).toBeGreaterThan(12);
    expect(dist).toBeLessThan(18);
  });

  test("calcula distância para cidade distante no interior", () => {
    const dist = calcDistanceKm(distCenter.lat, distCenter.lng, clientCampinas.lat, clientCampinas.lng);
    expect(dist).toBeGreaterThan(80);
    expect(dist).toBeLessThan(100);
  });

  test("retorna 0 para a mesma localização", () => {
    const dist = calcDistanceKm(distCenter.lat, distCenter.lng, distCenter.lat, distCenter.lng);
    expect(dist).toBe(0);
  });
});

describe("Validação de Elegibilidade por Raio de Entrega", () => {
  const distLat = -23.55052;
  const distLng = -46.633308;
  const maxRadiusKm = 20;

  function isEligible(clientLat: number, clientLng: number, maxRadius: number): boolean {
    const distance = calcDistanceKm(distLat, distLng, clientLat, clientLng);
    return distance <= maxRadius;
  }

  test("cliente dentro do raio (6km <= 20km) é elegível", () => {
    const clientLat = -23.56168;
    const clientLng = -46.69055;
    expect(isEligible(clientLat, clientLng, maxRadiusKm)).toBe(true);
  });

  test("cliente fora do raio (85km > 20km) NÃO é elegível", () => {
    const clientLat = -22.90556;
    const clientLng = -47.06083;
    expect(isEligible(clientLat, clientLng, maxRadiusKm)).toBe(false);
  });
});
