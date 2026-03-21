import { prisma } from "@/lib/prisma";

const SYNC_SERVER_URL = process.env.SYNC_SERVER_URL || "https://habakkukpharmacy.com";
const SYNC_API_KEY = process.env.SYNC_API_KEY || "";
const BATCH_SIZE = 50;

// All models synced during incremental sync (parents before children)
const INCREMENTAL_MODELS = [
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
];

export async function runSync(options?: { forceFull?: boolean }) {
    if (process.env.NEXT_PUBLIC_IS_DESKTOP !== "true") return;
    if (!SYNC_API_KEY) {
        console.warn("[Sync] SYNC_API_KEY not set — skipping sync.");
        return;
    }

    try {
        const online = await checkOnlineStatus();
        if (!online) {
            console.log("[Sync] Offline — skipping sync.");
            return;
        }

        console.log("[Sync] Starting sync...");
        await pushChanges();
        await pullChanges({ forceFull: options?.forceFull });
        console.log("[Sync] Sync complete.");
    } catch (err) {
        console.error("[Sync] Fatal error:", err);
    }
}

// ── Online Check ─────────────────────────────────────────────────────────────
async function checkOnlineStatus(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${SYNC_SERVER_URL}/api/public/ping`, {
            signal: controller.signal,
            cache: "no-store",
        });
        clearTimeout(timeout);
        return res.ok;
    } catch {
        return false;
    }
}

// ── PUSH: local offline changes → cloud ──────────────────────────────────────
async function pushChanges() {
    const pending = await prisma.syncQueue.findMany({
        where: { status: { in: ["PENDING", "ERROR"] } },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
    });

    if (pending.length === 0) {
        console.log("[Sync] No pending items to push.");
        return;
    }

    console.log(`[Sync] Pushing ${pending.length} items...`);
    await prisma.syncQueue.updateMany({
        where: { id: { in: pending.map((i: any) => i.id) } },
        data: { status: "PROCESSING" },
    });

    try {
        const res = await fetch(`${SYNC_SERVER_URL}/api/sync/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: SYNC_API_KEY, syncItems: pending }),
        });

        if (!res.ok) throw new Error(`Push HTTP ${res.status}: ${res.statusText}`);
        const result = await res.json();

        for (const r of result.results || []) {
            await prisma.syncQueue.update({
                where: { id: r.id },
                data: { status: r.status === "SYNCED" ? "SYNCED" : "ERROR", error: r.error || null },
            });
        }

        const ok = result.results?.filter((r: any) => r.status === "SYNCED").length ?? 0;
        const bad = result.results?.filter((r: any) => r.status === "ERROR").length ?? 0;
        console.log(`[Sync] Push done — ${ok} synced, ${bad} failed.`);

    } catch (err: any) {
        console.error("[Sync] Push error:", err.message);
        await prisma.syncQueue.updateMany({
            where: { id: { in: pending.map((i: any) => i.id) } },
            data: { status: "ERROR", error: err.message },
        });
    }
}

// ── PULL: cloud changes → local ───────────────────────────────────────────────
async function pullChanges(options?: { forceFull?: boolean }) {
    const lastSyncLog = await prisma.syncLog.findFirst({
        orderBy: { lastSyncAt: "desc" },
        where: { status: "SUCCESS" },
    });

    // If we have never synced, or force flag is set, do a full pull of everything
    const forceFull = options?.forceFull === true || process.env.SYNC_FORCE_FULL === "true";
    const isFirstSync = !lastSyncLog || forceFull;
    const lastSyncAt = isFirstSync
        ? new Date(0).toISOString()
        : lastSyncLog!.lastSyncAt.toISOString();

    if (isFirstSync) {
        console.log("[Sync] Full pull enabled — pulling all records from cloud...");
    }

    try {
        const g = globalThis as any;
        const prev = g.__HABAKKUK_SYNC_SUPPRESS_QUEUE;
        g.__HABAKKUK_SYNC_SUPPRESS_QUEUE = true;

        let page = 0;
        let hasMore = true;
        let totalApplied = 0;

        try {
            while (hasMore) {
                const res = await fetch(`${SYNC_SERVER_URL}/api/sync/pull`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        apiKey: SYNC_API_KEY,
                        lastSyncAt,
                        models: INCREMENTAL_MODELS,
                        fullSync: isFirstSync,
                        page,
                    }),
                });

                if (!res.ok) throw new Error(`Pull HTTP ${res.status}: ${res.statusText}`);
                const result = await res.json();
                if (!result.success) throw new Error("Pull returned failure");

                let batchCount = 0;
                for (const [modelName, records] of Object.entries(result.changes)) {
                    const recs = records as any[];
                    if (recs.length === 0) continue;

                    console.log(`[Sync] Applying ${recs.length} ${modelName} records...`);
                    const model = (prisma as any)[modelName];
                    if (!model) continue;

                    for (const record of recs) {
                        try {
                            const { id, ...data } = record;
                            const safe = stripRelations(modelName, data);
                            const exists = await model.findUnique({ where: { id } });
                            if (exists) {
                                await model.update({ where: { id }, data: safe });
                            } else {
                                await model.create({ data: { id, ...safe } });
                            }
                            batchCount++;
                        } catch (e: any) {
                            console.warn(`[Sync] Skipped ${modelName}[${record.id}]: ${e.message}`);
                        }
                    }
                }

                totalApplied += batchCount;
                hasMore = batchCount >= 500;
                page++;
            }
        } finally {
            g.__HABAKKUK_SYNC_SUPPRESS_QUEUE = prev;
        }

        // Record successful sync
        await prisma.syncLog.create({
            data: {
                status: "SUCCESS",
                lastSyncAt: new Date(),
                details: `Pull applied ${totalApplied} records.`,
            },
        });

        console.log(`[Sync] Pull done — ${totalApplied} records applied.`);

    } catch (err: any) {
        console.error("[Sync] Pull error:", err.message);
        await prisma.syncLog.create({
            data: { status: "ERROR", details: err.message },
        });
    }
}

// ── Strip relations and convert types for SQLite ──────────────────────────────
function stripRelations(modelName: string, data: Record<string, any>): Record<string, any> {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) {
            // Special case: permissions array → comma-string for SQLite users
            if (modelName === "user" && k === "permissions") {
                clean[k] = (v as string[]).join(",");
            }
            // All other arrays are nested relations → skip
            continue;
        }
        if (v !== null && typeof v === "object" && !(v instanceof Date)) continue;
        clean[k] = v;
    }
    return clean;
}
