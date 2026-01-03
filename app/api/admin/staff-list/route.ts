import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"

// This endpoint returns staff members for the POS staff selection
// Available to any authenticated user with POS access
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        // Exclude special accounts
        NOT: [
          { email: "habakkuk@habakkukpharmacy.com" },
          { role: "ADMIN" },
          { role: "CEO" },
        ],
        // Also exclude by name pattern
        name: {
          not: {
            contains: "habakkuk boss",
            mode: "insensitive",
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Get staff list error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
