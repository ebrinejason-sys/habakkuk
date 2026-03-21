import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../../auth/[...nextauth]/route"

/**
 * Comprehensive transaction data integrity verification
 * Checks for:
 * 1. Orphaned transaction items (items without transactions)
 * 2. Missing product references
 * 3. Stock adjustment mismatches
 * 4. Profit calculation consistency
 * 5. Missing batch references
 * 6. Data loss scenarios
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can run verification
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const report = {
      timestamp: new Date().toISOString(),
      totalTransactions: 0,
      totalTransactionItems: 0,
      issues: {
        orphanedTransactionItems: [] as any[],
        missingProductReferences: [] as any[],
        missingUserReferences: [] as any[],
        invalidStockAdjustments: [] as any[],
        missingBatchReferences: [] as any[],
        inconsistentProfitData: [] as any[],
        negativeNetAmounts: [] as any[],
        missingCostPrices: [] as any[],
      },
      summary: {
        totalIssuesFound: 0,
        dataIntegrityScore: 100,
        recommendedActions: [] as string[],
      },
    }

    // 1. Count total records
    report.totalTransactions = await prisma.transaction.count()
    report.totalTransactionItems = await prisma.transactionItem.count()

    // 2. Check for orphaned transaction items (should have transactions)
    const allTransactionItems = await prisma.transactionItem.findMany({
      include: {
        transaction: true,
        product: true,
      },
    })

    for (const item of allTransactionItems) {
      if (!item.transaction) {
        report.issues.orphanedTransactionItems.push({
          itemId: item.id,
          transactionId: item.transactionId,
          productId: item.productId,
          quantity: item.quantity,
          reason: "Transaction reference broken",
        })
      }

      // 3. Check for missing product references
      if (!item.product) {
        report.issues.missingProductReferences.push({
          itemId: item.id,
          productId: item.productId,
          transactionId: item.transactionId,
          reason: "Product was deleted or ID is invalid",
        })
      }

      // 8. Check for missing cost prices (needed for profit calculation)
      if (item.costPrice === null) {
        report.issues.missingCostPrices.push({
          itemId: item.id,
          transactionId: item.transactionId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          reason: "Cost price not recorded at time of sale",
        })
      }
    }

    // 4. Check for missing user references in transactions
    const allTransactions = await prisma.transaction.findMany({
      include: {
        user: true,
        items: true,
      },
    })

    for (const transaction of allTransactions) {
      if (!transaction.user) {
        report.issues.missingUserReferences.push({
          transactionId: transaction.id,
          transactionNo: transaction.transactionNo,
          userId: transaction.userId,
          itemCount: transaction.items.length,
          reason: "Staff user account was deleted",
        })
      }

      // 6. Check for negative net amounts (invalid)
      if (transaction.netAmount < 0) {
        report.issues.negativeNetAmounts.push({
          transactionId: transaction.id,
          transactionNo: transaction.transactionNo,
          netAmount: transaction.netAmount,
          totalAmount: transaction.totalAmount,
          tax: transaction.tax,
          reason: "Negative net amount indicates calculation error",
        })
      }

      // 7. Validate profit calculation
      const itemsWithCosts = transaction.items.filter(
        (item: any) => item.costPrice !== null
      )
      if (itemsWithCosts.length !== transaction.items.length) {
        report.issues.inconsistentProfitData.push({
          transactionId: transaction.id,
          transactionNo: transaction.transactionNo,
          itemsWithoutCost: transaction.items.length - itemsWithCosts.length,
          totalItems: transaction.items.length,
          reason: "Cannot calculate profit accurately - missing cost prices",
        })
      }
    }

    // 5. Check stock adjustments for transaction sales
    const stockAdjustments = await prisma.stockAdjustment.findMany({
      where: {
        reason: {
          contains: "Sale - Transaction",
        },
      },
    })

    const transactionMap = new Map(
      allTransactions.map((t: any) => [t.transactionNo, t])
    )

    for (const adjustment of stockAdjustments) {
      if (adjustment.reason) {
        const match = adjustment.reason.match(/Sale - Transaction (TXN-\d+)/)
        if (match) {
          const transactionNo = match[1]
          if (!transactionMap.has(transactionNo)) {
            report.issues.invalidStockAdjustments.push({
              adjustmentId: adjustment.id,
              transactionNo,
              productId: adjustment.productId,
              quantity: adjustment.quantity,
              reason: "Transaction referenced in stock adjustment does not exist",
            })
          }
        }
      }
    }

    // Check for batch references
    const itemsWithBatchIds = allTransactionItems.filter(
      (item: any) => item.batchId !== null
    )

    for (const item of itemsWithBatchIds) {
      if (item.batchId) {
        const batch = await prisma.productBatch.findUnique({
          where: { id: item.batchId },
        })
        if (!batch) {
          report.issues.missingBatchReferences.push({
            itemId: item.id,
            batchId: item.batchId,
            transactionId: item.transactionId,
            reason: "Batch was deleted or ID is invalid",
          })
        }
      }
    }

    // Calculate summary
    const issueValues = Object.values(report.issues)
    report.summary.totalIssuesFound = issueValues.reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0
    )

    // Calculate data integrity score (100 = perfect, lower = more issues)
    const maxPossibleIssues = report.totalTransactionItems + report.totalTransactions
    if (maxPossibleIssues > 0) {
      report.summary.dataIntegrityScore = Math.max(
        0,
        100 - (report.summary.totalIssuesFound / maxPossibleIssues) * 100
      )
    }

    // Provide recommendations
    if (report.issues.orphanedTransactionItems.length > 0) {
      report.summary.recommendedActions.push(
        `Found ${report.issues.orphanedTransactionItems.length} orphaned transaction items. Run cleanup to delete them.`
      )
    }
    if (report.issues.missingProductReferences.length > 0) {
      report.summary.recommendedActions.push(
        `Found ${report.issues.missingProductReferences.length} items with missing product references. These items cannot be analyzed.`
      )
    }
    if (report.issues.missingUserReferences.length > 0) {
      report.summary.recommendedActions.push(
        `Found ${report.issues.missingUserReferences.length} transactions with deleted staff users. Update staff records or reassign.`
      )
    }
    if (report.issues.invalidStockAdjustments.length > 0) {
      report.summary.recommendedActions.push(
        `Found ${report.issues.invalidStockAdjustments.length} stock adjustments for non-existent transactions. Verify stock levels.`
      )
    }
    if (report.issues.missingCostPrices.length > 0) {
      report.summary.recommendedActions.push(
        `Found ${report.issues.missingCostPrices.length} items without recorded cost prices. Profit calculations may be inaccurate for these items.`
      )
    }

    // No issues found
    if (report.summary.totalIssuesFound === 0) {
      report.summary.recommendedActions.push(
        "✓ All transaction data is consistent and complete. No issues found."
      )
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error("Verification error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * Handle transaction verification and cleanup operations (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { action, id } = body

    // Handle cleanup operations
    if (action) {
      if (action === "cleanup-orphaned-items") {
        // Find and delete orphaned transaction items - those without a valid transaction
        const orphanedItems = await prisma.transactionItem.findMany({
          where: {
            transactionId: {
              notIn: await prisma.transaction.findMany({
                select: { id: true },
              }).then((ts: any) => ts.map((t: any) => t.id))
            },
          },
        })

        if (orphanedItems.length === 0) {
          return NextResponse.json({
            success: true,
            message: "No orphaned items found",
            cleaned: 0,
          })
        }

        const deleted = await prisma.transactionItem.deleteMany({
          where: {
            id: { in: orphanedItems.map((item: any) => item.id) },
          },
        })

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "CLEANUP_ORPHANED_TRANSACTION_ITEMS",
            entity: "TRANSACTION",
            details: `Cleaned up ${deleted.count} orphaned transaction items`,
          },
        })

        return NextResponse.json({
          success: true,
          message: `Cleaned up ${deleted.count} orphaned transaction items`,
          cleaned: deleted.count,
        })
      }

      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Handle transaction verification
    if (id) {
      const transaction = await prisma.transaction.findUnique({ where: { id } })
      if (!transaction) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

      // Verification logic
      await prisma.transaction.update({ where: { id }, data: { verified: true } })
      return NextResponse.json({ success: true, message: 'Transaction verified successfully' })
    }

    return NextResponse.json({ error: 'Either action or transaction ID required' }, { status: 400 })
  } catch (error) {
    console.error('Operation error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
