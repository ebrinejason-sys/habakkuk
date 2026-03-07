import { NextResponse } from "next/server";
import { runSync } from "@/lib/syncClient";

export async function GET() {
    if (process.env.NEXT_PUBLIC_IS_DESKTOP !== "true") {
        return NextResponse.json({ message: "Not in desktop mode" });
    }

    // Fire and forget the sync
    runSync();

    return NextResponse.json({ message: "Sync triggered" });
}
