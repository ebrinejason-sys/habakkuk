import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"

// Reset all sales/transactions (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 })
    }

    // Delete all transaction items first (due to foreign key constraint)
    await prisma.transactionItem.deleteMany({})
    
    // Delete all transactions
    const deletedTransactions = await prisma.transaction.deleteMany({})

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "RESET_SALES",
        entity: "TRANSACTION",
        details: `Reset all sales. Deleted ${deletedTransactions.count} transactions.`,
      },
    })

    return NextResponse.json({ 
      success: true, 
      message: `Successfully reset sales. Deleted ${deletedTransactions.count} transactions.`,
      deletedCount: deletedTransactions.count
    })
  } catch (error) {
    console.error("Reset sales error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

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
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                costPrice: true,
                expiryDate: true,
                batchNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    // Calculate profit for each period
    const calculateProfit = (items: any[]) => {
      return items.reduce((total: number, item: any) => {
        const profit = (item.unitPrice - item.product.costPrice) * item.quantity
        return total + profit
      }, 0)
    }

    // Define date boundaries FIRST before using them
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    const todayTransactions = await prisma.transaction.findMany({
      where: { status: "COMPLETED", createdAt: { gte: today } },
      include: {
        items: {
          include: {
            product: {
              select: { costPrice: true },
            },
          },
        },
      },
    })

    const weekTransactions = await prisma.transaction.findMany({
      where: { status: "COMPLETED", createdAt: { gte: weekAgo } },
      include: {
        items: {
          include: {
            product: {
              select: { costPrice: true },
            },
          },
        },
      },
    })

    const monthTransactions = await prisma.transaction.findMany({
      where: { status: "COMPLETED", createdAt: { gte: monthAgo } },
      include: {
        items: {
          include: {
            product: {
              select: { costPrice: true },
            },
          },
        },
      },
    })

    // Calculate stats
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
        todayProfit: todayTransactions.reduce((sum, t) => sum + calculateProfit(t.items), 0),
        weekProfit: weekTransactions.reduce((sum, t) => sum + calculateProfit(t.items), 0),
        monthProfit: monthTransactions.reduce((sum, t) => sum + calculateProfit(t.items), 0),
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
