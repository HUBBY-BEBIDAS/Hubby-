import { NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { validateCnpjReceita, cleanCnpj, validateCnpjFormat } from "@/lib/cnpj";

/**
 * GET /api/distributor/cnpj?cnpj=00000000000100
 *
 * Valida o CNPJ localmente (formato + dígitos) e consulta a Receita Federal.
 * Retorna os dados da empresa para pré-preencher o formulário.
 */
export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("cnpj") ?? "";
    const cnpj = cleanCnpj(raw);

    if (!cnpj) {
      return Response.json({ error: "Parâmetro 'cnpj' é obrigatório" }, { status: 400 });
    }

    if (!validateCnpjFormat(cnpj)) {
      return Response.json(
        { valid: false, reason: "invalid_format", message: "CNPJ inválido — verifique os dígitos verificadores" },
        { status: 422 }
      );
    }

    const result = await validateCnpjReceita(cnpj);

    if (!result.valid) {
      return Response.json(result, { status: 422 });
    }

    const { data } = result;

    // Retorna dados da Receita para pré-preencher o formulário
    return Response.json({
      valid: true,
      cnpj,
      company_name: data.razao_social,
      fantasy_name: data.nome_fantasia || null,
      situacao_cadastral: data.situacao_cadastral,
      address_suggestion: {
        zipcode: data.cep?.replace(/\D/g, "") ?? "",
        street: data.logradouro ?? "",
        number: data.numero ?? "",
        complement: data.complemento ?? "",
        district: data.bairro ?? "",
        city: data.municipio ?? "",
        state: data.uf ?? "",
      },
      cnae: {
        code: data.cnae_fiscal,
        description: data.cnae_fiscal_descricao,
      },
      started_at: data.data_inicio_atividade,
    });
  },
  { roles: ["distributor_admin"] }
);
