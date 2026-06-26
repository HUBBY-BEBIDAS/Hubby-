import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { redis } from "@/lib/redis";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: string | boolean;
};

export type CepResult = {
  zip_code: string;
  city: string;
  state: string;
  street: string;
  district: string;
};

/**
 * GET /api/address/cep/:cep
 *
 * Consulta o ViaCEP e retorna dados do endereço.
 * Resultado cacheado no Redis por 7 dias.
 */
export const GET = withAuth(
  async (_req: NextRequest, _user, context) => {
    const raw = context?.params.cep ?? "";
    const cep = raw.replace(/\D/g, "");

    if (cep.length !== 8) {
      return Response.json({ error: "CEP inválido — informe 8 dígitos" }, { status: 400 });
    }

    const cacheKey = `cep:${cep}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return Response.json(JSON.parse(cached as string));
    } catch {
      // ignora falha de cache — continua sem cache
    }

    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json({ error: "Serviço de CEP indisponível" }, { status: 503 });
    }

    const data = await res.json() as ViaCepResponse;

    if (data.erro) {
      // Cache CEPs inválidos por 24h para evitar chamadas repetidas
      try { await redis.setex(`cep:invalid:${cep}`, 86400, "1"); } catch { /* silencia */ }
      return Response.json({ error: "CEP não encontrado" }, { status: 404 });
    }

    const payload: CepResult = {
      zip_code: cep,
      city:     data.localidade ?? "",
      state:    data.uf ?? "",
      street:   data.logradouro ?? "",
      district: data.bairro ?? "",
    };

    try { await redis.setex(cacheKey, 7 * 24 * 3600, JSON.stringify(payload)); } catch { /* silencia */ }

    return Response.json(payload);
  }
);
