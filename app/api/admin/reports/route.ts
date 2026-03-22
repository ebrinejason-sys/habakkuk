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
    const canViewReports = userRole === "ADMIN" || userRole === "CEO" || userPermissions.includes("VIEW_REPORTS")

    if (!canViewReports) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get("type") || "sales"
    const period = searchParams.get("period") || "today"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Calculate date range
    let dateFrom: Date
    let dateTo: Date = new Date()

    switch (period) {
      case "today":
        dateFrom = new Date(new Date().setHours(0, 0, 0, 0))
        break
      case "yesterday":
        dateFrom = new Date(new Date().setHours(0, 0, 0, 0))
        dateFrom.setDate(dateFrom.getDate() - 1)
        dateTo = new Date(new Date().setHours(0, 0, 0, 0))
        break
      case "week":
        dateFrom = new Date()
        dateFrom.setDate(dateFrom.getDate() - 7)
        break
      case "month":
        dateFrom = new Date()
        dateFrom.setMonth(dateFrom.getMonth() - 1)
        break
      case "year":
        dateFrom = new Date()
        dateFrom.setFullYear(dateFrom.getFullYear() - 1)
        break
      case "custom":
        dateFrom = startDate ? new Date(startDate) : new Date()
        dateTo = endDate ? new Date(endDate) : new Date()
        break
      default:
        dateFrom = new Date(new Date().setHours(0, 0, 0, 0))
    }

    if (reportType === "sales") {
      // Sales Report
      const [
        totalSales,
        transactionCount,
        transactions,
        salesByPaymentMethod,
        allTransactionsInRange,
        topProducts,
        salesByUser,
      ] = await Promise.all([
        // Total sales
        prisma.transaction.aggregate({
          _sum: { netAmount: true, discount: true, tax: true },
          where: {
            status: "COMPLETED",
            createdAt: { gte: dateFrom, lte: dateTo },
          },
        }),
        // Transaction count
        prisma.transaction.count({
          where: {
            status: "COMPLETED",
            createdAt: { gte: dateFrom, lte: dateTo },
          },
        }),
        // Recent transactions
        prisma.transaction.findMany({
          where: {
            status: "COMPLETED",
            createdAt: { gte: dateFrom, lte: dateTo },
          },
          include: {
            user: { select: { name: true } },
            items: {
              include: { product: { select: { name: true, category: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        // Sales by payment method
        prisma.transaction.groupBy({
          by: ["paymentMethod"],
          _sum: { netAmount: true },
          _count: true,
          where: {
            status: "COMPLETED",
            createdAt: { gte: dateFrom, lte: dateTo },
          },
        }),
        // All transactions in range for chart and additional analytics (database-agnostic)
        prisma.transaction.findMany({
          where: {
            status: "COMPLETED",
            createdAt: { gte: dateFrom, lte: dateTo },
          },
          select: {
            createdAt: true,
            netAmount: true,
            clientName: true,
            items: {
              select: {
                totalPrice: true,
                product: { select: { category: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        // Top selling products
        prisma.transactionItem.groupBy({
          by: ["productId"],
          _sum: { quantity: true, totalPrice: true },
          where: {
            transaction: {
              status: "COMPLETED",
              createdAt: { gte: dateFrom, lte: dateTo },
            },
          },
          orderBy: { _sum: { totalPrice: "desc" } },
          take: 10,
        }),
        // Sales by user
        prisma.transaction.groupBy({
          by: ["userId"],
          _sum: { netAmount: true },
          _count: true,
          where: {
            status: "COMPLETED",
            createdAt: { gte: dateFrom, lte: dateTo },
          },
        }),
      ])

      // Group sales by day, category and customer in JS (database-agnostic)
      const salesByDayMap = new Map<string, { date: string; total: number; count: number }>()
      const salesByCategoryMap = new Map<string, { category: string; total: number; count: number }>()
      const topCustomersMap = new Map<string, { name: string; total: number; count: number }>()

      allTransactionsInRange.forEach((tx: any) => {
        const dateStr = tx.createdAt.toISOString().split("T")[0]
        const existingDay = salesByDayMap.get(dateStr) || { date: dateStr, total: 0, count: 0 }
        existingDay.total += tx.netAmount
        existingDay.count += 1
        salesByDayMap.set(dateStr, existingDay)

        // Group by category
        tx.items.forEach((item: any) => {
          const category = item.product?.category || "Uncategorized"
          const existingCat = salesByCategoryMap.get(category) || { category, total: 0, count: 0 }
          existingCat.total += item.totalPrice
          existingCat.count += 1
          salesByCategoryMap.set(category, existingCat)
        })

        // Group by customer
        if (tx.clientName) {
          const existingCust = topCustomersMap.get(tx.clientName) || { name: tx.clientName, total: 0, count: 0 }
          existingCust.total += tx.netAmount
          existingCust.count += 1
          topCustomersMap.set(tx.clientName, existingCust)
        }
      })

      const salesByDay = Array.from(salesByDayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
      const salesByCategory = Array.from(salesByCategoryMap.values()).sort((a, b) => b.total - a.total)
      const topCustomers = Array.from(topCustomersMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)

      // Get product names for top products
      const productIds = topProducts.map((p: any) => p.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      })

      const topProductsWithNames = topProducts.map((p: any) => ({
        ...p,
        product: products.find((prod: any) => prod.id === p.productId),
      }))

      // Get user names for sales by user
      const userIds = salesByUser.map((u: any) => u.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })

      const salesByUserWithNames = salesByUser.map((u: any) => ({
        ...u,
        user: users.find((user: any) => user.id === u.userId),
      }))

      return NextResponse.json({
        type: "sales",
        period,
        dateFrom,
        dateTo,
        summary: {
          totalSales: totalSales._sum.netAmount || 0,
          totalDiscount: totalSales._sum.discount || 0,
          totalTax: totalSales._sum.tax || 0,
          transactionCount,
          averageTransaction: transactionCount > 0 
            ? (totalSales._sum.netAmount || 0) / transactionCount 
            : 0,
        },
        salesByPaymentMethod,
        salesByDay,
        salesByCategory,
        topCustomers,
        topProducts: topProductsWithNames,
        salesByUser: salesByUserWithNames,
        transactions,
      })
    }

    if (reportType === "inventory") {
      // Get global low stock threshold
      const settings = await prisma.settings.findFirst()
      const lowStockThreshold = settings?.lowStockThreshold || 10

      // Inventory Report
      const [
        totalProducts,
        totalValue,
        lowStockProducts,
        outOfStockProducts,
        expiringProducts,
        expiredProducts,
        productsByCategory,
        stockMovements,
      ] = await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.product.aggregate({
          _sum: { quantity: true },
          where: { isActive: true },
        }),
        // Low stock
        prisma.product.findMany({
          where: {
            isActive: true,
            quantity: {
              gt: 0,
              lte: lowStockThreshold
            },
          },
          orderBy: { quantity: "asc" },
        }),
        // Out of stock
        prisma.product.findMany({
          where: {
            isActive: true,
            quantity: { lte: 0 },
          },
        }),
        // Expiring in 30 days
        prisma.product.findMany({
          where: {
            isActive: true,
            expiryDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { expiryDate: "asc" },
        }),
        // Already expired
        prisma.product.findMany({
          where: {
            isActive: true,
            expiryDate: { lt: new Date() },
          },
        }),
        // Products by category
        prisma.product.groupBy({
          by: ["category"],
          _count: true,
          _sum: { quantity: true },
          where: { isActive: true },
        }),
        // Recent stock movements
        prisma.stockAdjustment.findMany({
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
          },
          include: {
            product: { select: { name: true, sku: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ])

      // Calculate inventory value
      const allProducts = await prisma.product.findMany({
        where: { isActive: true },
        select: { quantity: true, costPrice: true, price: true },
      })

      const inventoryValueAtCost = allProducts.reduce(
        (sum: number, p: any) => sum + p.quantity * p.costPrice,
        0
      )
      const inventoryValueAtRetail = allProducts.reduce(
        (sum: number, p: any) => sum + p.quantity * p.price,
        0
      )

      return NextResponse.json({
        type: "inventory",
        period,
        dateFrom,
        dateTo,
        summary: {
          totalProducts,
          totalUnits: totalValue._sum.quantity || 0,
          inventoryValueAtCost,
          inventoryValueAtRetail,
          potentialProfit: inventoryValueAtRetail - inventoryValueAtCost,
          lowStockCount: lowStockProducts.length,
          outOfStockCount: outOfStockProducts.length,
          expiringCount: expiringProducts.length,
          expiredCount: expiredProducts.length,
        },
        lowStockProducts,
        outOfStockProducts,
        expiringProducts,
        expiredProducts,
        productsByCategory,
        stockMovements,
      })
    }

    if (reportType === "profit") {
      // Profit Report
      const transactions = await prisma.transaction.findMany({
        where: {
          status: "COMPLETED",
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        include: {
          items: {
            include: {
              product: {
                select: { costPrice: true, name: true, category: true },
              },
            },
          },
        },
      })

      let totalRevenue = 0
      let totalCost = 0
      const profitByProduct: Record<string, { name: string; revenue: number; cost: number; profit: number; quantity: number }> = {}
      const profitByCategory: Record<string, { category: string; revenue: number; cost: number; profit: number }> = {}

      transactions.forEach((t: any) => {
        t.items.forEach((item: any) => {
          // Priority: 1. Item-specific costPrice (historical), 2. Current product costPrice, 3. Zero
          const unitCost = item.costPrice !== null ? item.costPrice : (item.product?.costPrice || 0)
          const cost = unitCost * item.quantity

          totalRevenue += item.totalPrice
          totalCost += cost

          const productId = item.productId || "unknown"
          if (!profitByProduct[productId]) {
            profitByProduct[productId] = {
              name: item.product?.name || "Unknown",
              revenue: 0,
              cost: 0,
              profit: 0,
              quantity: 0,
            }
          }
          profitByProduct[productId].revenue += item.totalPrice
          profitByProduct[productId].cost += cost
          profitByProduct[productId].profit += item.totalPrice - cost
          profitByProduct[productId].quantity += item.quantity

          const category = item.product?.category || "Uncategorized"
          if (!profitByCategory[category]) {
            profitByCategory[category] = {
              category,
              revenue: 0,
              cost: 0,
              profit: 0,
            }
          }
          profitByCategory[category].revenue += item.totalPrice
          profitByCategory[category].cost += cost
          profitByCategory[category].profit += item.totalPrice - cost
        })
      })

      const profitByProductArray = Object.values(profitByProduct).sort(
        (a, b) => b.profit - a.profit
      )

      const profitByCategoryArray = Object.values(profitByCategory).sort(
        (a, b) => b.profit - a.profit
      )

      return NextResponse.json({
        type: "profit",
        period,
        dateFrom,
        dateTo,
        summary: {
          totalRevenue,
          totalCost,
          grossProfit: totalRevenue - totalCost,
          profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
          transactionCount: transactions.length,
        },
        profitByProduct: profitByProductArray.slice(0, 50),
        profitByCategory: profitByCategoryArray,
      })
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
  } catch (error) {
    console.error("Reports error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
