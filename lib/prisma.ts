import { PrismaClient } from '@prisma/client'

const basePrisma = new PrismaClient()

// Prisma Extension to automatically queue offline changes for sync
const enhancedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);

        // We only care about mutations for the Sync Queue
        const isMutation = ["create", "update", "delete", "upsert"].includes(operation);
        // We don't want to sync the sync log itself!
        const isNotSyncModel = model !== "SyncQueue" && model !== "SyncLog" && model !== "AuditLog";

        // If we are in desktop mode, it means this is a local DB and we should queue for cloud sync
        if (isMutation && isNotSyncModel && process.env.NEXT_PUBLIC_IS_DESKTOP === "true") {
          try {
            let entityIdStr = "";
            let action: "CREATE" | "UPDATE" | "DELETE" = "UPDATE";

            if (operation === "create") action = "CREATE";
            if (operation === "delete") action = "DELETE";

            if (result && (result as any).id) {
              entityIdStr = String((result as any).id);
            }

            if (entityIdStr) {
              // Note: we use basePrisma to avoid infinite loop of extensions
              await basePrisma.syncQueue.create({
                data: {
                  action,
                  entityType: model,
                  entityId: entityIdStr,
                  payload: JSON.stringify(result)
                }
              });
            }
          } catch (syncErr) {
            console.error("Failed to queue sync operation:", syncErr);
          }
        }

        return result;
      }
    }
  }
});

const globalForPrisma = globalThis as unknown as {
  prisma: typeof enhancedPrisma | undefined
}

export const prisma = globalForPrisma.prisma ?? enhancedPrisma

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

