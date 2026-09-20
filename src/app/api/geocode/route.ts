import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { redis } from "@/lib/redis";
import { geocodeCepOrAddress } from "@/lib/geocoding";

export const POST = withAuth(async (req: NextRequest) => {
  let body: { address?: string; lat?: number; lng?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Reverse geocode: lat/lng → address
  if (body.lat !== undefined && body.lng !== undefined) {
    const { lat, lng } = body;
    const cacheKey = `geocode:rev:${lat.toFixed(5)}:${lng.toFixed(5)}`;

    const cached = await redis.get(cacheKey);
    if (cached) return Response.json(JSON.parse(cached as string));

    if (apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&region=BR&language=pt-BR&key=${apiKey}`;
        const res = await fetch(url);
        const data = (await res.json()) as { status: string; results?: { formatted_address: string }[] };

        if (data.status === "OK" && data.results?.[0]) {
          const payload = { lat, lng, formattedAddress: data.results[0].formatted_address };
          await redis.setex(cacheKey, 86400, JSON.stringify(payload));
          return Response.json(payload);
        }
      } catch {
        // Fallback para OpenStreetMap
      }
    }

    // Fallback gratuito OpenStreetMap Nominatim reverse
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "HubbySaaS/1.0 (contact@hubby.com.br)" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          const payload = { lat, lng, formattedAddress: data.display_name };
          await redis.setex(cacheKey, 86400, JSON.stringify(payload));
          return Response.json(payload);
        }
      }
    } catch {
      // Falha
    }

    return Response.json({ lat, lng, formattedAddress: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}` });
  }

  // Forward geocode: address → lat/lng
  if (!body.address || body.address.trim().length < 3) {
    return Response.json({ error: "Endereço inválido" }, { status: 400 });
  }

  const address = body.address.trim();
  const cacheKey = `geocode:${address.toLowerCase()}`;

  const cached = await redis.get(cacheKey);
  if (cached) return Response.json(JSON.parse(cached as string));

  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=BR&language=pt-BR&components=country:BR&key=${apiKey}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        status: string;
        results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
      };

      if (data.status === "OK" && data.results?.[0]) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        const payload = { lat, lng, formattedAddress: result.formatted_address };
        await redis.setex(cacheKey, 86400, JSON.stringify(payload));
        return Response.json(payload);
      }
    } catch {
      // Fallback
    }
  }

  // Fallback gratuito usando BrasilAPI (se for CEP) e OpenStreetMap (Nominatim)
  const coords = await geocodeCepOrAddress({
    cep: address.replace(/\D/g, "").length === 8 ? address : null,
    addressFull: address,
  });

  if (coords) {
    const payload = { lat: coords.lat, lng: coords.lng, formattedAddress: address };
    await redis.setex(cacheKey, 86400, JSON.stringify(payload));
    return Response.json(payload);
  }

  return Response.json({ error: "Endereço não encontrado" }, { status: 404 });
});
