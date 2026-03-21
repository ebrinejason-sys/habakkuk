import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// The desktop app calls this endpoint to push offline changes to the cloud
function normalizeSyncData(entityType: string, entityId: string, raw: any, forCreate: boolean) {
  const base: Record<string, any> = {};

  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (k === "id") continue;
      if (Array.isArray(v)) continue;
      if (v !== null && typeof v === "object") continue;
      base[k] = v;
    }
  }

  if (entityType.toLowerCase() === "user" && typeof base.permissions === "string") {
    base.permissions = base.permissions ? base.permissions.split(",").filter(Boolean) : [];
  }

  if (forCreate) {
    return { ...base, id: entityId };
  }

  return base;
}

function getPrismaModel(entityType: string) {
  const p: any = prisma as any;
  const direct = p[entityType];
  if (direct) return direct;

  const camel = entityType ? entityType.charAt(0).toLowerCase() + entityType.slice(1) : entityType;
  const camelModel = p[camel];
  if (camelModel) return camelModel;

  const lowerModel = p[entityType.toLowerCase()];
  if (lowerModel) return lowerModel;

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { syncItems, apiKey } = await req.json();

    // Basic security check (in production, use a strong environment variable)
    if (apiKey !== process.env.SYNC_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Array.isArray(syncItems) || syncItems.length === 0) {
      return NextResponse.json({ message: "No items to sync", processed: 0 });
    }

    // Process each item
    const results = [];
    let processedCount = 0;

    for (const item of syncItems) {
      try {
        const { id, action, entityType, entityId, payload } = item;
        const parsed = JSON.parse(payload);
        
        // Dynamic prisma model access
        const model = getPrismaModel(entityType);
        
        if (!model) {
          throw new Error(`Unknown entity type: ${entityType}`);
        }

        if (action === "CREATE") {
          const createData = normalizeSyncData(entityType, entityId, parsed, true);
          const updateData = normalizeSyncData(entityType, entityId, parsed, false);
          // Check if it already exists to avoid unique constraint errors on retry
          const existing = await model.findUnique({ where: { id: entityId } });
          if (!existing) {
            await model.create({ data: createData });
          } else {
             // If it exists, we might want to update it instead
             await model.update({ where: { id: entityId }, data: updateData });
          }
        } else if (action === "UPDATE") {
          const updateData = normalizeSyncData(entityType, entityId, parsed, false);
          await model.update({
            where: { id: entityId },
            data: updateData,
          });
        } else if (action === "DELETE") {
           // Check if it exists before deleting
           const existing = await model.findUnique({ where: { id: entityId } });
           if (existing) {
             await model.delete({ where: { id: entityId } });
           }
        }

        results.push({ id, status: "SYNCED" });
        processedCount++;
      } catch (err: any) {
        console.error("Sync error for item:", item.id, err);
        results.push({ id: item.id, status: "ERROR", error: err.message });
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: processedCount,
      results 
    });

  } catch (error: any) {
    console.error("Push sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
