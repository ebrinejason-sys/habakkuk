import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cloud Pull Endpoint — serves data from PostgreSQL to the desktop app.
 * 
 * Supports two modes:
 * 1. INCREMENTAL (default):  returns records updated after `lastSyncAt`
 * 2. FULL (fullSync: true):  returns ALL records across all models (initial setup)
 * 
 * All data is paginated: 500 records per model per request.
 * 
 * Models synced (in dependency order):
 *   Settings → User → Customer → Supplier
 *   → Product → ProductPackage → ProductBatch → StockAdjustment
 *   → PurchaseOrder → PurchaseOrderItem
 *   → Order → OrderItem
 *   → Transaction → TransactionItem → TransactionEdit
 *   → AuditLog → Inquiry → Notification
 */

// Models ordered by dependency (parents before children)
const SYNC_MODELS = [
    "settings",
    "user",
    "customer",
    "supplier",
    "product",
    "productPackage",
    "productBatch",
    "stockAdjustment",
    "purchaseOrder",
    "purchaseOrderItem",
    "order",
    "orderItem",
    "transaction",
    "transactionItem",
    "transactionEdit",
    "inquiry",
    "notification",
    // audit_logs excluded — too large / not needed on desktop
];

// Models that DO NOT have an `updatedAt` field (created-only)
const NO_UPDATED_AT = new Set([
    "stockAdjustment",
    "auditLog",
    "inquiry",
    "notification",
    "transactionEdit",
    "orderItem",
    "purchaseOrderItem",
    "transactionItem",
]);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { lastSyncAt, apiKey, models, fullSync = false, page = 0 } = body;

        if (apiKey !== process.env.SYNC_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Determine which models to query
        const requestedModels: string[] = models || SYNC_MODELS;
        const syncDate = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
        const PAGE_SIZE = 500;
        const skip = page * PAGE_SIZE;

        const changes: Record<string, any[]> = {};
        let totalRecords = 0;

        for (const modelName of requestedModels) {
            const model = (prisma as any)[modelName];
            if (!model) continue;

            try {
                // Build filter: full sync = all records; incremental = updated after lastSyncAt
                let where: any = {};

                if (!fullSync && !NO_UPDATED_AT.has(modelName)) {
                    where.updatedAt = { gt: syncDate };
                } else if (!fullSync && NO_UPDATED_AT.has(modelName)) {
                    // For models without updatedAt, use createdAt
                    where.createdAt = { gt: syncDate };
                }
                // fullSync = no filter, get everything

                const records = await model.findMany({
                    where,
                    take: PAGE_SIZE,
                    skip,
                });

                changes[modelName] = records;
                totalRecords += records.length;
            } catch (modelErr: any) {
                console.error(`[Pull] Error querying ${modelName}:`, modelErr.message);
                changes[modelName] = [];
            }
        }

        return NextResponse.json({
            success: true,
            changes,
            totalRecords,
            page,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error("Pull sync error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
