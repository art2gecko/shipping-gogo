-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('OK', 'ERROR', 'NEEDS_REAUTH');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_CONNECT';
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_TEST';
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_DISCONNECT';

-- CreateTable
CREATE TABLE "channel_accounts" (
    "id" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "account_name" TEXT NOT NULL,
    "external_seller_id" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'OK',
    "scopes" TEXT,
    "refresh_token_encrypted" TEXT,
    "access_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "raw_meta" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_states_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "channel_account_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "channel_accounts_channel_external_seller_id_key" ON "channel_accounts"("channel", "external_seller_id");

-- CreateIndex
CREATE INDEX "channel_accounts_channel_status_idx" ON "channel_accounts"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_states_state_key" ON "integration_states"("state");

-- CreateIndex
CREATE INDEX "integration_states_expires_at_idx" ON "integration_states"("expires_at");

-- CreateIndex
CREATE INDEX "orders_channel_account_id_idx" ON "orders"("channel_account_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_account_id_fkey" FOREIGN KEY ("channel_account_id") REFERENCES "channel_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
