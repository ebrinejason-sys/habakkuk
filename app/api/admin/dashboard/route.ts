import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "CEO")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    const [
      totalUsers,
      totalProducts,
      totalRevenueData,
      todaySalesData,
      lowStockCount,
      pendingOrders,
      expiringProducts,
      recentActivity,
      users,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.transaction.aggregate({
        _sum: { netAmount: true },
        where: { status: "COMPLETED" },
      }),
      prisma.transaction.aggregate({
        _sum: { netAmount: true },
        where: {
          status: "COMPLETED",
          createdAt: {
            gte: todayStart,
          },
        },
      }),
      prisma.product.count({
        where: {
          quantity: { lte: prisma.product.fields.reorderLevel },
          isActive: true,
        },
      }),
      prisma.order.count({
        where: { status: "PENDING" },
      }),
      // Get products expiring in next 30 days
      prisma.product.findMany({
        where: {
          isActive: true,
          expiryDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          expiryDate: true,
          quantity: true,
        },
        orderBy: {
          expiryDate: 'asc',
        },
      }),
      // Get recent activity logs
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              role: true,
            },
          },
        },
      }),
      // Get all users for stats calculation
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
        },
      }),
    ])

    // Calculate user stats for today
    const userStats = await Promise.all(
      users.map(async (user) => {
        const [todayTransactions, todayOrders] = await Promise.all([
          prisma.transaction.aggregate({
            _sum: { netAmount: true },
            _count: true,
            where: {
              userId: user.id,
              status: "COMPLETED",
              createdAt: { gte: todayStart },
            },
          }),
          prisma.order.count({
            where: {
              processedBy: user.id,
              createdAt: { gte: todayStart },
            },
          }),
        ])

        return {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          todaySales: todayTransactions._sum.netAmount || 0,
          todayOrders: todayOrders,
          todayTransactions: todayTransactions._count,
        }
      })
    )

    // Sort by today's sales descending
    userStats.sort((a, b) => b.todaySales - a.todaySales)

    return NextResponse.json({
      totalUsers,
      totalProducts,
      totalRevenue: totalRevenueData._sum.netAmount || 0,
      todaySales: todaySalesData._sum.netAmount || 0,
      lowStockCount,
      pendingOrders,
      expiringProducts,
      recentActivity,
      userStats,
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
