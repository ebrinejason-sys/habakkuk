import { NextResponse } from "next/server";
import { runSync } from "@/lib/syncClient";

export async function GET(req: Request) {
    if (process.env.NEXT_PUBLIC_IS_DESKTOP !== "true") {
        return NextResponse.json({ message: "Not in desktop mode" });
    }

    const { searchParams } = new URL(req.url);
    const forceFull = searchParams.get("full") === "true";

    // Fire and forget the sync
    runSync({ forceFull });

    return NextResponse.json({ message: "Sync triggered", forceFull });
}
