-- AlterTable: adiciona snapshot de itens e índice por group_id
ALTER TABLE "orders"
  ADD COLUMN "items_snapshot" JSONB;

-- CreateIndex: busca eficiente de grupos de pedidos
CREATE INDEX "orders_group_id_idx" ON "orders"("group_id");
