/**
 * Initial Full Sync — run once during first desktop setup.
 * 
 * Connects to habakkukpharmacy.com and pulls ALL existing data
 * into the local SQLite database (replaces sample seed data).
 * 
 * Usage:
 *   npx tsx scripts/initial-sync.ts
 * 
 * Requires:
 *   - .env with SYNC_SERVER_URL and SYNC_API_KEY set
 *   - Local SQLite database already created (run db:desktop:setup first)
 *   - Internet connection
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// Load .env manually (this runs outside Next.js context)
function loadEnv() {
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) {
        console.error("ERROR: .env file not found. Cannot proceed.");
        process.exit(1);
    }
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
    }
}

loadEnv();

const SYNC_SERVER_URL = process.env.SYNC_SERVER_URL || "https://habakkukpharmacy.com";
const SYNC_API_KEY = process.env.SYNC_API_KEY || "";
const PAGE_SIZE = 500;

const prisma = new PrismaClient();

// All models in order of dependency (parents must exist before children)
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
];

// Fields to strip when writing to SQLite (relations / arrays / enums)
function sanitizeRecord(modelName: string, record: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(record)) {
        if (Array.isArray(v)) continue;           // skip nested relations
        if (v !== null && typeof v === "object" && !(v instanceof Date)) continue; // skip objects
        out[k] = v;
    }
    // SQLite: permissions is a comma-separated String, not an array
    if (modelName === "user" && Array.isArray(record.permissions)) {
        out.permissions = (record.permissions as string[]).join(",");
    }
    // Enum fields become Strings automatically since SQLite schema uses String
    return out;
}

async function checkConnectivity(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${SYNC_SERVER_URL}/api/public/ping`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return res.ok;
    } catch {
        return false;
    }
}

async function pullPage(page: number): Promise<{ changes: Record<string, any[]>; total: number }> {
    const res = await fetch(`${SYNC_SERVER_URL}/api/sync/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apiKey: SYNC_API_KEY,
            models: SYNC_MODELS,
            fullSync: true,
            page,
        }),
    });

    if (!res.ok) {
        throw new Error(`Cloud pull failed: HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.success) throw new Error(`Cloud pull returned error: ${JSON.stringify(data)}`);

    return { changes: data.changes || {}, total: data.totalRecords || 0 };
}

async function upsertRecords(modelName: string, records: any[]) {
    const model = (prisma as any)[modelName];
    if (!model) {
        console.warn(`  ⚠️  Model '${modelName}' not found in local Prisma client — skipping`);
        return 0;
    }

    let applied = 0;
    for (const record of records) {
        try {
            const { id, ...rest } = record;
            if (!id) continue;
            const safe = sanitizeRecord(modelName, { id, ...rest });

            const exists = await model.findUnique({ where: { id } });
            if (exists) {
                const { id: _id, ...updateData } = safe;
                await model.update({ where: { id }, data: updateData });
            } else {
                await model.create({ data: safe });
            }
            applied++;
        } catch (err: any) {
            // Skip records that fail due to broken foreign keys etc. — don't abort
            console.warn(`  ⚠️  Skipped ${modelName}[${record.id}]: ${err.message}`);
        }
    }
    return applied;
}

async function main() {
    console.log("");
    console.log("=================================================");
    console.log("  Habakkuk Pharmacy — Initial Full Sync");
    console.log("=================================================");
    console.log(`  Source: ${SYNC_SERVER_URL}`);
    console.log("");

    if (!SYNC_API_KEY) {
        console.error("ERROR: SYNC_API_KEY is not set in .env");
        console.error("       Add it and make sure habakkukpharmacy.com also has it set.");
        process.exit(1);
    }

    // Check connectivity
    console.log("Checking connectivity to cloud...");
    const isOnline = await checkConnectivity();
    if (!isOnline) {
        console.error("ERROR: Cannot reach habakkukpharmacy.com");
        console.error("       Make sure you have internet and the site is live.");
        console.error("       The local DB will use sample data until sync is available.");
        process.exit(1);
    }
    console.log("✅ Cloud is reachable\n");

    // Pull data page by page (handles large datasets)
    const grandTotal: Record<string, number> = {};
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        console.log(`Fetching page ${page + 1} from cloud...`);
        const { changes, total } = await pullPage(page);

        // Count records in this batch
        let batchTotal = 0;
        for (const [model, records] of Object.entries(changes)) {
            batchTotal += records.length;
        }

        if (batchTotal === 0) {
            hasMore = false;
            break;
        }

        // Write each model's records to local SQLite
        for (const modelName of SYNC_MODELS) {
            const records = changes[modelName] || [];
            if (records.length === 0) continue;

            process.stdout.write(`  Applying ${records.length} ${modelName} records... `);
            const applied = await upsertRecords(modelName, records);
            grandTotal[modelName] = (grandTotal[modelName] || 0) + applied;
            console.log(`✅ ${applied}`);
        }

        // If this page returned < PAGE_SIZE, there's no next page
        hasMore = batchTotal >= PAGE_SIZE;
        page++;
    }

    // Log successful sync
    await prisma.syncLog.create({
        data: {
            status: "SUCCESS",
            lastSyncAt: new Date(),
            details: `Initial full sync: ${JSON.stringify(grandTotal)}`,
        },
    });

    console.log("");
    console.log("=================================================");
    console.log("  Initial Sync Complete!");
    console.log("=================================================");
    const totalCount = Object.values(grandTotal).reduce((a, b) => a + b, 0);
    console.log(`  Total records imported: ${totalCount}`);
    for (const [model, count] of Object.entries(grandTotal)) {
        if (count > 0) console.log(`  • ${model}: ${count}`);
    }
    console.log("");
    console.log("  The local database now mirrors the cloud.");
    console.log("  Going forward, changes will sync every 30 seconds.");
    console.log("");
}

main()
    .catch(e => {
        console.error("\n❌ Initial sync failed:", e.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
