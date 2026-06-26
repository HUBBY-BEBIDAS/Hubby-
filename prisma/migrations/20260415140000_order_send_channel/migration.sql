-- AlterTable: registra o canal de envio escolhido pelo comprador
ALTER TABLE "orders" ADD COLUMN "send_channel" TEXT;
