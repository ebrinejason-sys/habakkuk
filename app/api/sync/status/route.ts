import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Returns current sync status:
 * - pending: number of items waiting to be pushed to cloud
 * - lastSync: timestamp of last successful sync
 * - isDesktop: whether the app is in desktop mode
 */
export async function GET(req: NextRequest) {
    const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === "true";

    if (!isDesktop) {
        return NextResponse.json({
            isDesktop: false,
            pending: 0,
            lastSync: null,
        });
    }

    try {
        const [pendingCount, lastSyncLog] = await Promise.all([
            prisma.syncQueue.count({
                where: { status: { in: ["PENDING", "ERROR"] } }
            }),
            prisma.syncLog.findFirst({
                orderBy: { lastSyncAt: "desc" },
                where: { status: "SUCCESS" }
            })
        ]);

        return NextResponse.json({
            isDesktop: true,
            pending: pendingCount,
            lastSync: lastSyncLog?.lastSyncAt ?? null,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
