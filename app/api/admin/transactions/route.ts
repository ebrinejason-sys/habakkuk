import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const transactions = await prisma.transaction.findMany({
      where: { status: "COMPLETED" },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    // Calculate stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    const [todayStats, weekStats, monthStats] = await Promise.all([
      prisma.transaction.aggregate({
        _sum: { netAmount: true },
        where: { status: "COMPLETED", createdAt: { gte: today } },
      }),
      prisma.transaction.aggregate({
        _sum: { netAmount: true },
        where: { status: "COMPLETED", createdAt: { gte: weekAgo } },
      }),
      prisma.transaction.aggregate({
        _sum: { netAmount: true },
        where: { status: "COMPLETED", createdAt: { gte: monthAgo } },
      }),
    ])

    return NextResponse.json({
      transactions,
      stats: {
        today: todayStats._sum.netAmount || 0,
        week: weekStats._sum.netAmount || 0,
        month: monthStats._sum.netAmount || 0,
      },
    })
  } catch (error) {
    console.error("Get transactions error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
