/*
  Warnings:

  - The `payment_terms_days` column on the `distributors` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "distributors" DROP COLUMN "payment_terms_days",
ADD COLUMN     "payment_terms_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
