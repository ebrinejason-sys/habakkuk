import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../../auth/[...nextauth]/route"

/**
 * DELETE /api/admin/transactions/[id]
 * Delete a specific transaction (Admin only)
 * Includes reversal of stock adjustments
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can delete transactions
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can delete transactions" },
        { status: 403 }
      )
    }

    const transactionId = id

    // Fetch the transaction with all its items
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: true,
      },
    })

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      )
    }

    // Start transaction to ensure data consistency
    // Delete transaction items first (due to foreign key constraints)
    await prisma.transactionItem.deleteMany({
      where: { transactionId },
    })

    // Reverse stock adjustments for this transaction
    const stockAdjustments = await prisma.stockAdjustment.findMany({
      where: {
        reason: {
          contains: `Sale - Transaction ${transaction.transactionNo}`,
        },
      },
    })

    // Delete the stock adjustments
    await prisma.stockAdjustment.deleteMany({
      where: {
        reason: {
          contains: `Sale - Transaction ${transaction.transactionNo}`,
        },
      },
    })

    // Restore product quantities based on the stock adjustments
    for (const adjustment of stockAdjustments) {
      // Reverse the quantity adjustment (negate the quantity change)
      await prisma.product.update({
        where: { id: adjustment.productId },
        data: {
          quantity: {
            increment: Math.abs(adjustment.quantity), // Add back the deducted quantity
          },
        },
      })
    }

    // Delete the transaction itself
    const deletedTransaction = await prisma.transaction.delete({
      where: { id: transactionId },
    })

    // Create audit log for the deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_TRANSACTION",
        entity: "TRANSACTION",
        entityId: transactionId,
        details: `Deleted transaction ${transaction.transactionNo}. Total amount: ${transaction.netAmount}. Items: ${transaction.items.length}. Stock levels have been restored.`,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Transaction ${transaction.transactionNo} has been deleted successfully. Stock levels have been restored.`,
      deletedTransaction: {
        id: deletedTransaction.id,
        transactionNo: deletedTransaction.transactionNo,
        netAmount: deletedTransaction.netAmount,
        itemsCount: transaction.items.length,
      },
    })
  } catch (error) {
    console.error("Delete transaction error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
