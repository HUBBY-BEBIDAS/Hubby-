import { z } from "zod";
import { validateCnpjFormat } from "@/lib/cnpj";

// ─── Endereço ─────────────────────────────────────────────────────────────────

export const addressSchema = z.object({
  zipcode: z
    .string()
    .regex(/^\d{8}$/, "CEP deve ter 8 dígitos (sem hífen)"),
  street: z.string().min(3, "Logradouro é obrigatório"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  district: z.string().min(2, "Bairro é obrigatório"),
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z
    .string()
    .length(2, "UF deve ter 2 letras")
    .toUpperCase(),
});

export type Address = z.infer<typeof addressSchema>;

// ─── Formas de pagamento ───────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  "pix",
  "boleto",
  "credit_card",
  "bank_transfer",
  "check",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ─── Perfil da distribuidora ──────────────────────────────────────────────────

export const distributorProfileSchema = z.object({
  company_name: z
    .string()
    .min(3, "Razão social deve ter ao menos 3 caracteres")
    .max(200),
  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(validateCnpjFormat, "CNPJ inválido — verifique os dígitos"),
  responsible_name: z
    .string()
    .min(3, "Nome do responsável deve ter ao menos 3 caracteres")
    .max(100),
  whatsapp_commercial: z
    .string()
    .min(10, "WhatsApp inválido")
    .max(20)
    .transform((v) => v.replace(/\D/g, "")),
  email_commercial: z.string().email("Email comercial inválido"),
  logo_key: z.string().optional(),
  address: addressSchema.optional(),
  payment_methods: z
    .array(z.enum(PAYMENT_METHODS))
    .min(1, "Selecione ao menos uma forma de pagamento"),
  payment_terms_days: z
    .array(
      z.number({ message: "Prazo deve ser um número" })
        .int()
        .min(0, "Prazo não pode ser negativo")
        .max(90, "Prazo máximo de 90 dias")
    )
    .default([]),
  // Critério de crédito
  use_platform_credit_default: z.boolean().default(true),
  credit_score_minimum: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional(),
  credit_accepts_restrictions: z.boolean().default(false),
  credit_min_cnpj_months: z
    .number()
    .int()
    .min(0)
    .max(120)
    .default(6),
});

export type DistributorProfileInput = z.infer<typeof distributorProfileSchema>;

// ─── Região de entrega ────────────────────────────────────────────────────────

export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

export const FREIGHT_TYPES = ["free", "fixed", "by_weight", "by_value", "custom"] as const;
export type FreightType = (typeof FREIGHT_TYPES)[number];

export const deliveryRegionSchema = z.object({
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z
    .string()
    .length(2, "UF deve ter 2 letras")
    .toUpperCase(),
  delivery_days_business: z
    .number({ message: "Prazo deve ser um número" })
    .int()
    .min(1, "Prazo mínimo de 1 dia útil")
    .max(30, "Prazo máximo de 30 dias úteis"),
  route_days: z
    .array(z.enum(WEEK_DAYS))
    .min(1, "Selecione ao menos um dia de rota"),
  cutoff_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Horário no formato HH:MM (ex: 15:00)")
    .refine((t) => {
      const [h, m] = t.split(":").map(Number);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    }, "Horário inválido"),
  minimum_order_cents: z
    .number()
    .int()
    .min(0)
    .default(0),
  freight_type: z.enum(FREIGHT_TYPES).default("free"),
  freight_value_cents: z.number().int().min(0).optional(),
  free_freight_above_cents: z.number().int().min(0).optional(),
  freight_notes: z.string().max(500).optional(),
});

export type DeliveryRegionInput = z.infer<typeof deliveryRegionSchema>;

// ─── Bulk de regiões ──────────────────────────────────────────────────────────

export const deliveryRegionsBulkSchema = z.object({
  regions: z
    .array(deliveryRegionSchema)
    .min(1, "Informe ao menos uma região de entrega"),
});
