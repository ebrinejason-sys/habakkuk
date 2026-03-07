import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// The desktop app calls this endpoint to push offline changes to the cloud
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
        const data = JSON.parse(payload);
        
        // Dynamic prisma model access
        const model = (prisma as any)[entityType.toLowerCase()];
        
        if (!model) {
          throw new Error(`Unknown entity type: ${entityType}`);
        }

        if (action === "CREATE") {
          // Check if it already exists to avoid unique constraint errors on retry
          const existing = await model.findUnique({ where: { id: entityId } });
          if (!existing) {
            await model.create({ data });
          } else {
             // If it exists, we might want to update it instead
             await model.update({ where: { id: entityId }, data });
          }
        } else if (action === "UPDATE") {
          await model.update({
            where: { id: entityId },
            data,
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
