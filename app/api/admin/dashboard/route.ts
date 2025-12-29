import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [
      totalUsers,
      totalProducts,
      totalRevenueData,
      todaySalesData,
      lowStockCount,
      pendingOrders,
      expiringProducts,
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
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
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
    ])

    return NextResponse.json({
      totalUsers,
      totalProducts,
      totalRevenue: totalRevenueData._sum.netAmount || 0,
      todaySales: todaySalesData._sum.netAmount || 0,
      lowStockCount,
      pendingOrders,
      expiringProducts,
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
