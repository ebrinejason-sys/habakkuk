// Load SQLite client if running in desktop mode, otherwise load standard PostgreSQL client
const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true';

let PrismaClientToUse: any;

if (isDesktop) {
  try {
    // Desktop mode: load the SQLite client (generated into @prisma/client-sqlite)
    const sqliteClient = require('@prisma/client-sqlite');
    PrismaClientToUse = sqliteClient.PrismaClient;
    console.log('[Prisma] Loading SQLite client for Desktop mode');
  } catch (e) {
    console.warn('[Prisma] SQLite client not found. Falling back to default client.');
    // Fallback: try the standard PG client (will fail if DATABASE_URL is sqlite)
    const { PrismaClient: PgClient } = require('@prisma/client');
    PrismaClientToUse = PgClient;
  }
} else {
  // Cloud/server mode: load the PostgreSQL client
  const { PrismaClient: PgClient } = require('@prisma/client');
  PrismaClientToUse = PgClient;
}

const basePrisma = new PrismaClientToUse();

function isSyncQueueSuppressed() {
  return (globalThis as any).__HABAKKUK_SYNC_SUPPRESS_QUEUE === true;
}

// Prisma Extension to automatically queue offline changes for sync
const enhancedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const result = await query(args);

        // We only care about mutations for the Sync Queue
        const isMutation = ["create", "update", "delete", "upsert"].includes(operation);
        // We don't want to sync the sync log itself!
        const isNotSyncModel = !["SyncQueue", "syncQueue", "SyncLog", "syncLog", "AuditLog", "auditLog"].includes(model);

        // If we are in desktop mode, it means this is a local DB and we should queue for cloud sync
        if (isMutation && isNotSyncModel && process.env.NEXT_PUBLIC_IS_DESKTOP === "true" && !isSyncQueueSuppressed()) {
          try {
            let entityIdStr = "";
            let action: "CREATE" | "UPDATE" | "DELETE" = "UPDATE";

            if (operation === "create") action = "CREATE";
            if (operation === "delete") action = "DELETE";

            if (result && (result as any).id) {
              entityIdStr = String((result as any).id);
            }

            if (entityIdStr) {
              const entityType = model ? model.charAt(0).toLowerCase() + model.slice(1) : model;
              // Note: we use basePrisma to avoid infinite loop of extensions
              await basePrisma.syncQueue.create({
                data: {
                  action,
                  entityType,
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

