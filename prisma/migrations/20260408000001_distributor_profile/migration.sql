-- AlterTable: adiciona campos de perfil, logo, pagamento e validação de CNPJ
ALTER TABLE "distributors"
  ADD COLUMN "responsible_name"  TEXT         NOT NULL DEFAULT '',
  ADD COLUMN "logo_key"          TEXT,
  ADD COLUMN "address"           JSONB,
  ADD COLUMN "payment_methods"   TEXT[]       NOT NULL DEFAULT '{}',
  ADD COLUMN "payment_terms_days" INTEGER,
  ADD COLUMN "cnpj_status"       TEXT,
  ADD COLUMN "cnpj_verified_at"  TIMESTAMP(3);
