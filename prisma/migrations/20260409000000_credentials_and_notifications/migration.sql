-- AlterTable: adiciona campos de auditoria e nota ao credenciamento
ALTER TABLE "client_credentials"
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "review_note"      TEXT,
  ADD COLUMN "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable: notificações in-app
CREATE TABLE "notifications" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "read"       BOOLEAN NOT NULL DEFAULT false,
    "data"       JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: leitura eficiente de notificações não lidas por usuário
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
