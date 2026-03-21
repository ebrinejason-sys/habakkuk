-- Add client details fields to transactions (for receipts)
ALTER TABLE "transactions" ADD COLUMN "clientName" TEXT;
ALTER TABLE "transactions" ADD COLUMN "clientPhone" TEXT;
ALTER TABLE "transactions" ADD COLUMN "clientAddress" TEXT;

