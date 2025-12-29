import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"

// GET - List all activity logs (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN" && session.user.role !== "CEO") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000, // Limit to last 1000 entries
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
