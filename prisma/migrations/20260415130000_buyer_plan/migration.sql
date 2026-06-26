-- CreateEnum
CREATE TYPE "ClientPlan" AS ENUM ('free', 'pro');

-- AlterTable: adiciona plano do comprador ao model Client
ALTER TABLE "clients"
  ADD COLUMN "client_plan"            "ClientPlan" NOT NULL DEFAULT 'free',
  ADD COLUMN "client_plan_status"     "PlanStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "stripe_customer_id"     TEXT,
  ADD COLUMN "stripe_subscription_id" TEXT;

-- CreateIndex: unicidade dos IDs Stripe do comprador
CREATE UNIQUE INDEX "clients_stripe_customer_id_key"     ON "clients"("stripe_customer_id");
CREATE UNIQUE INDEX "clients_stripe_subscription_id_key" ON "clients"("stripe_subscription_id");
