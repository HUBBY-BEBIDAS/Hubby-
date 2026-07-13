import { NextRequest } from "next/server";
import crypto from "crypto";
import { withAuth } from "@/lib/with-auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  parseUnstructuredDeliveryXlsxWithLayout,
} from "@/lib/excel-parser";
import { detectarDeliveryLayoutComGemini } from "@/lib/gemini-parser";
import { getRawExcelStructureForLayout } from "@/app/api/distributor/products/import/preview/route";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const PREVIEW_TTL = 30 * 60; // 30 minutos

function deliveryPreviewKey(distributorId: string, token: string): string {
  return `delivery-preview:${distributorId}:${token}`;
}

function normalizeCityNameForLookup(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim();
}

export const POST = withAuth(
  async (req: NextRequest, user) => {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ error: "Envie o arquivo como multipart/form-data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "Campo 'file' não encontrado" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return Response.json(
        { error: "Formato inválido — envie um arquivo .xlsx" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB` },
        { status: 413 }
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { user_id: user.userId },
      select: { id: true },
    });
    if (!distributor) {
      return Response.json({ error: "Perfil de distribuidora não encontrado" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let valid_rows: any[] = [];
    let errors: any[] = [];

    try {
      console.log("[delivery-preview] Carregando cidades de cobertura do banco...");
      // Busca todas as cidades de cobertura do banco para cruzar e descobrir os estados
      const coverageCities = await prisma.coverageCity.findMany({
        select: { city: true, state: true }
      });
      
      const citiesLookup = new Map<string, string>();
      for (const cc of coverageCities) {
        citiesLookup.set(normalizeCityNameForLookup(cc.city), cc.state);
      }

      console.log("[delivery-preview] Analisando snippet da planilha com Gemini para detecção de layout...");
      // 1. Extrai a estrutura das primeiras 20 linhas para a IA
      const structure = await getRawExcelStructureForLayout(buffer, 20);

      // 2. IA detecta o layout da planilha
      const layout = await detectarDeliveryLayoutComGemini(structure);
      console.log("[delivery-preview] Layout detectado:", layout);

      // 3. Executa o parser local de alta performance com o layout detectado
      const parseResult = await parseUnstructuredDeliveryXlsxWithLayout(buffer, {
        header_row: layout.header_row,
        city_column: layout.city_column,
        days_columns: layout.days_columns
      }, citiesLookup);

      valid_rows = parseResult.valid_rows;
      errors = parseResult.errors;

      // 4. Cruzamento com as regiões existentes no banco de dados para determinar se é Novo ou Atualização
      const existingRegions = await prisma.deliveryRegion.findMany({
        where: { distributor_id: distributor.id },
        select: { city: true, state: true, route_days: true }
      });

      const existingMap = new Map<string, string[]>();
      for (const r of existingRegions) {
        const key = `${normalizeCityNameForLookup(r.city)}|${r.state.toUpperCase()}`;
        existingMap.set(key, r.route_days);
      }

      valid_rows = valid_rows.map((row) => {
        const lookupKey = `${normalizeCityNameForLookup(row.city)}|${row.state.toUpperCase()}`;
        const existingDays = existingMap.get(lookupKey);
        
        const isUpdate = existingDays !== undefined;
        let changeType: "new" | "update" | "no_change" = "new";
        
        if (isUpdate) {
          const sortedNew = [...row.route_days].sort();
          const sortedOld = [...(existingDays || [])].sort();
          const hasChanged = JSON.stringify(sortedNew) !== JSON.stringify(sortedOld);
          changeType = hasChanged ? "update" : "no_change";
        }

        return {
          ...row,
          is_update: isUpdate,
          change_type: changeType,
          old_route_days: existingDays || []
        };
      });

    } catch (err: any) {
      console.error("[delivery-preview] Erro no processamento de rotas de entrega:", err);
      return Response.json(
        { error: `Falha ao interpretar planilha: ${err.message}` },
        { status: 500 }
      );
    }

    const token = crypto.randomUUID();
    const key = deliveryPreviewKey(distributor.id, token);

    try {
      await redis.setex(
        key,
        PREVIEW_TTL,
        JSON.stringify({
          valid_rows,
          distributor_id: distributor.id
        })
      );
    } catch (redisErr) {
      console.warn("[delivery-preview] Falha ao salvar no Redis:", redisErr);
    }

    return Response.json({
      token,
      summary: {
        total_cities: valid_rows.length,
        new_cities: valid_rows.filter(r => r.change_type === "new" && r.route_days.length > 0).length,
        updated_cities: valid_rows.filter(r => r.change_type === "update").length,
        no_change_cities: valid_rows.filter(r => r.change_type === "no_change").length,
        out_of_route_cities: valid_rows.filter(r => r.route_days.length === 0).length,
        error_count: errors.length
      },
      valid_rows: valid_rows,
      errors: errors.slice(0, 50),
      expires_in_minutes: PREVIEW_TTL / 60
    });
  },
  { roles: ["distributor_admin"] }
);
