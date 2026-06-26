-- CreateEnum
CREATE TYPE "Role" AS ENUM ('client', 'distributor_admin', 'distributor_collaborator', 'platform_admin');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('vitrine', 'operacional', 'enterprise');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('sent', 'viewed', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'open', 'closed', 'expired');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('pending', 'approved', 'rejected_auto', 'rejected_manual');

-- CreateEnum
CREATE TYPE "EstablishmentType" AS ENUM ('bar', 'restaurant', 'adega', 'hotel', 'nightclub', 'supermarket', 'convenience', 'other');

-- CreateEnum
CREATE TYPE "PackagingType" AS ENUM ('garrafa', 'lata', 'barril', 'caixa', 'fardo', 'tetra_pak', 'other');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('beer', 'whisky', 'vodka', 'gin', 'rum', 'cachaca', 'wine', 'sparkling', 'energy', 'soft_drink', 'water', 'juice', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'credentials',
    "role" "Role" NOT NULL,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "establishment_type" "EstablishmentType" NOT NULL,
    "delivery_city" TEXT NOT NULL,
    "delivery_state" VARCHAR(2) NOT NULL,
    "delivery_address_full" TEXT NOT NULL,
    "responsible_name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "max_delivery_days_default" INTEGER,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'vitrine',
    "plan_status" "PlanStatus" NOT NULL DEFAULT 'trial',
    "whatsapp_commercial" TEXT NOT NULL,
    "email_commercial" TEXT NOT NULL,
    "credit_score_minimum" INTEGER NOT NULL DEFAULT 500,
    "credit_accepts_restrictions" BOOLEAN NOT NULL DEFAULT false,
    "credit_min_cnpj_months" INTEGER NOT NULL DEFAULT 6,
    "approved_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "brand" TEXT NOT NULL,
    "packaging_type" "PackagingType" NOT NULL,
    "packaging_volume_ml" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "price_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_regions" (
    "id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "delivery_days_business" INTEGER NOT NULL,
    "route_days" TEXT[],
    "cutoff_time" VARCHAR(5) NOT NULL,
    "minimum_order_cents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "delivery_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'draft',
    "max_delivery_days" INTEGER,
    "delivery_city" TEXT NOT NULL,
    "delivery_state" VARCHAR(2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "packaging" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'sent',
    "total_cents" INTEGER NOT NULL,
    "estimated_delivery_date" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_credentials" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "distributor_id" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'pending',
    "credit_score" INTEGER,
    "bureau_response" JSONB,
    "approved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_user_id_key" ON "clients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_cnpj_key" ON "clients"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "distributors_user_id_key" ON "distributors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "distributors_cnpj_key" ON "distributors"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_regions_distributor_id_city_state_key" ON "delivery_regions"("distributor_id", "city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "client_credentials_client_id_distributor_id_key" ON "client_credentials"("client_id", "distributor_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_regions" ADD CONSTRAINT "delivery_regions_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
