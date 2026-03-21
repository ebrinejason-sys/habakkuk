-- Create Client model for walk-in customers
CREATE TABLE "clients" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "lastVisit" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Create index on name for quick search
CREATE INDEX "clients_name_idx" ON "clients"("name");
