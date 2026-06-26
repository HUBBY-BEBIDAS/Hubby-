-- AlterTable: campos de integração Stripe na distribuidora
ALTER TABLE "distributors"
  ADD COLUMN "stripe_customer_id"     TEXT,
  ADD COLUMN "stripe_subscription_id" TEXT;

-- CreateIndex: lookup por customer/subscription ID do Stripe
CREATE UNIQUE INDEX "distributors_stripe_customer_id_key"     ON "distributors"("stripe_customer_id");
CREATE UNIQUE INDEX "distributors_stripe_subscription_id_key" ON "distributors"("stripe_subscription_id");
