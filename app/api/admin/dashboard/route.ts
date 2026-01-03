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

    const userRole = session.user.role
    const userPermissions = session.user.permissions || []
    const isAdmin = userRole === "ADMIN" || userRole === "CEO"
    const hasPOSAccess = isAdmin || userPermissions.includes("MANAGE_POS")
    const hasInventoryAccess = isAdmin || userPermissions.includes("MANAGE_INVENTORY") || userPermissions.includes("VIEW_INVENTORY")
    const hasTransactionAccess = isAdmin || userPermissions.includes("VIEW_TRANSACTIONS") || userPermissions.includes("MANAGE_TRANSACTIONS")

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    // Base queries that everyone can see
    const baseQueries = [
      prisma.product.count({ where: { isActive: true } }),
    ]

    // Admin-only queries
    if (isAdmin) {
      const [
        totalProducts,
        totalUsers,
        totalRevenueData,
        todaySalesData,
        lowStockCount,
        pendingOrders,
        expiringProducts,
        recentActivity,
        users,
      ] = await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.user.count(),
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
        userRole,
        isAdmin: true,
      })
    }

    // Non-admin user dashboard data
    const dashboardData: any = {
      userRole,
      isAdmin: false,
      permissions: userPermissions,
    }

    // Get total products (everyone with POS or inventory access can see this)
    if (hasPOSAccess || hasInventoryAccess) {
      dashboardData.totalProducts = await prisma.product.count({ where: { isActive: true } })
    }

    // Get low stock count (inventory access)
    if (hasInventoryAccess) {
      dashboardData.lowStockCount = await prisma.product.count({
        where: {
          quantity: { lte: prisma.product.fields.reorderLevel },
          isActive: true,
        },
      })
    }

    // Get personal sales stats (POS access)
    if (hasPOSAccess) {
      const [myTodaySales, myTotalSales, pendingOrders] = await Promise.all([
        prisma.transaction.aggregate({
          _sum: { netAmount: true },
          _count: true,
          where: {
            userId: session.user.id,
            status: "COMPLETED",
            createdAt: { gte: todayStart },
          },
        }),
        prisma.transaction.aggregate({
          _sum: { netAmount: true },
          _count: true,
          where: {
            userId: session.user.id,
            status: "COMPLETED",
          },
        }),
        prisma.order.count({
          where: { status: "PENDING" },
        }),
      ])

      dashboardData.myTodaySales = myTodaySales._sum.netAmount || 0
      dashboardData.myTodayTransactions = myTodaySales._count
      dashboardData.myTotalSales = myTotalSales._sum.netAmount || 0
      dashboardData.myTotalTransactions = myTotalSales._count
      dashboardData.pendingOrders = pendingOrders
    }

    // Get transaction history (transaction access)
    if (hasTransactionAccess) {
      const recentTransactions = await prisma.transaction.findMany({
        where: { userId: session.user.id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          transactionNo: true,
          netAmount: true,
          createdAt: true,
        },
      })
      dashboardData.recentTransactions = recentTransactions
    }

    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
