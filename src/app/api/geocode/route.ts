import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { redis } from "@/lib/redis";

export const POST = withAuth(async (req: NextRequest) => {
  let body: { address?: string; lat?: number; lng?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Geocoding não configurado" }, { status: 503 });
  }

  // Reverse geocode: lat/lng → address
  if (body.lat !== undefined && body.lng !== undefined) {
    const { lat, lng } = body;
    const cacheKey = `geocode:rev:${lat.toFixed(5)}:${lng.toFixed(5)}`;

    const cached = await redis.get(cacheKey);
    if (cached) return Response.json(JSON.parse(cached as string));

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&region=BR&language=pt-BR&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json() as { status: string; results?: { formatted_address: string }[] };

    if (data.status !== "OK" || !data.results?.[0]) {
      return Response.json({ error: "Localização não encontrada" }, { status: 404 });
    }

    const payload = { lat, lng, formattedAddress: data.results[0].formatted_address };
    await redis.setex(cacheKey, 86400, JSON.stringify(payload));
    return Response.json(payload);
  }

  // Forward geocode: address → lat/lng
  if (!body.address || body.address.trim().length < 5) {
    return Response.json({ error: "Endereço inválido" }, { status: 400 });
  }

  const address = body.address.trim();
  const cacheKey = `geocode:${address.toLowerCase()}`;

  const cached = await redis.get(cacheKey);
  if (cached) return Response.json(JSON.parse(cached as string));

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=BR&language=pt-BR&components=country:BR&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json() as {
    status: string;
    results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
  };

  if (data.status !== "OK" || !data.results?.[0]) {
    return Response.json({ error: "Endereço não encontrado" }, { status: 404 });
  }

  const result = data.results[0];
  const { lat, lng } = result.geometry.location;
  const payload = { lat, lng, formattedAddress: result.formatted_address };
  await redis.setex(cacheKey, 86400, JSON.stringify(payload));
  return Response.json(payload);
});
