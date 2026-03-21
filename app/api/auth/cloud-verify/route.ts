import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Cloud Verification Endpoint
 * 
 * Used by Desktop clients to verify credentials if the local DB is empty.
 * Requires a valid SYNC_API_KEY to prevent abuse.
 */
export async function POST(request: NextRequest) {
    try {
        const syncKey = request.headers.get("X-Sync-Key");
        if (syncKey !== process.env.SYNC_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { identifier, password } = await request.json();
        if (!identifier || !password) {
            return NextResponse.json({ error: "Missing identity" }, { status: 400 });
        }

        const trimmed = identifier.trim().toLowerCase();
        const isEmail = trimmed.includes("@");

        const user = await prisma.user.findUnique({
            where: isEmail ? { email: trimmed } : { username: trimmed },
        });

        if (!user || !user.isActive) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Return user data (minus sensitive info) for local creation
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userData } = user;
        return NextResponse.json({ success: true, user: userData });

    } catch (error) {
        console.error("[Cloud Verify] Error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
