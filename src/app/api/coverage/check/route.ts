import { NextRequest } from "next/server";
import { isCovered } from "@/lib/coverage";

/**
 * GET /api/coverage/check?city=São+Paulo&state=SP
 *
 * Endpoint público. Retorna se a cidade/estado está coberta.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city  = searchParams.get("city")?.trim()  ?? "";
  const state = searchParams.get("state")?.trim() ?? "";

  if (!city || !state) {
    return Response.json({ error: "city e state são obrigatórios" }, { status: 400 });
  }

  const covered = await isCovered(city, state);
  return Response.json({ covered, city, state });
}
