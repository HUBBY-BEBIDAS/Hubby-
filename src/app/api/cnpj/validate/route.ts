import { NextRequest } from "next/server";
import { validateCnpjReceita, cleanCnpj, validateCnpjFormat } from "@/lib/cnpj";

/**
 * GET /api/cnpj/validate?cnpj=00000000000100
 *
 * Endpoint público. Valida o CNPJ localmente e depois consulta na ReceitaWS.
 * Usado na tela de cadastro de novos usuários antes de possuírem credenciais.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("cnpj") ?? "";
  const cnpj = cleanCnpj(raw);

  if (!cnpj) {
    return Response.json({ error: "CNPJ é obrigatório" }, { status: 400 });
  }

  if (!validateCnpjFormat(cnpj)) {
    return Response.json(
      { valid: false, reason: "invalid_format", message: "CNPJ inválido — verifique os dígitos verificadores" },
      { status: 422 }
    );
  }

  const result = await validateCnpjReceita(cnpj);
  return Response.json(result);
}
