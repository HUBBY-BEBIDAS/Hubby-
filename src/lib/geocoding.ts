/**
 * Utilitário de Geocodificação para converter CEP / Endereços brasileiros em Coordenadas (lat, lng).
 * Suporta BrasilAPI v2 (CEP com coordenadas) e Nominatim OpenStreetMap como fallback.
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export async function geocodeCepOrAddress(params: {
  cep?: string | null;
  addressFull?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<GeoCoordinates | null> {
  const cleanCep = params.cep ? params.cep.replace(/\D/g, "") : "";

  // 1. Tentativa via BrasilAPI v2 (retorna lat/lng direto do CEP para a maioria dos CEPs BR)
  if (cleanCep.length === 8) {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`, {
        headers: { "User-Agent": "HubbySaaS/1.0" },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const lat = parseFloat(data.location?.coordinates?.latitude);
        const lng = parseFloat(data.location?.coordinates?.longitude);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          return { lat, lng };
        }
      }
    } catch {
      // Falha graciosa no fallback
    }
  }

  // 2. Tentativa via OpenStreetMap (Nominatim)
  try {
    const queryParts: string[] = [];
    if (params.addressFull) queryParts.push(params.addressFull);
    if (params.city) queryParts.push(params.city);
    if (params.state) queryParts.push(params.state);
    queryParts.push("Brasil");

    const query = encodeURIComponent(queryParts.join(", "));
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`,
      {
        headers: { "User-Agent": "HubbySaaS/1.0 (contact@hubby.com.br)" },
        signal: AbortSignal.timeout(4000),
      }
    );

    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    }
  } catch {
    // Falha graciosa
  }

  // 3. Fallback final: Busca apenas por Cidade + Estado no Nominatim
  if (params.city && params.state) {
    try {
      const query = encodeURIComponent(`${params.city}, ${params.state}, Brasil`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`,
        {
          headers: { "User-Agent": "HubbySaaS/1.0 (contact@hubby.com.br)" },
          signal: AbortSignal.timeout(4000),
        }
      );

      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
        }
      }
    } catch {
      // Retorna null se falhar
    }
  }

  return null;
}
