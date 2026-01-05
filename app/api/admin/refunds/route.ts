import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"

// GET - List refunds
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = session.user.role
    const userPermissions = session.user.permissions || []
    const canManageTransactions = userRole === "ADMIN" || userRole === "CEO" || userPermissions.includes("MANAGE_TRANSACTIONS")

    if (!canManageTransactions) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const refunds = await prisma.transaction.findMany({
      where: {
        status: "REFUNDED",
      },
      include: {
        user: { select: { name: true } },
        customer: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json(refunds)
  } catch (error) {
    console.error("Get refunds error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST - Process a refund
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = session.user.role
    const userPermissions = session.user.permissions || []
    const canManageTransactions = userRole === "ADMIN" || userRole === "CEO" || userPermissions.includes("MANAGE_TRANSACTIONS")

    if (!canManageTransactions) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { transactionId, reason, items } = await request.json()

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      )
    }

    // Get the original transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      )
    }

    if (transaction.status === "REFUNDED") {
      return NextResponse.json(
        { error: "Transaction already refunded" },
        { status: 400 }
      )
    }

    // If specific items are provided, process partial refund
    // Otherwise, process full refund
    const itemsToRefund = items && items.length > 0 ? items : transaction.items.map(i => ({
      id: i.id,
      quantity: i.quantity,
    }))

    // Calculate refund amount and restore stock
    let refundAmount = 0

    for (const refundItem of itemsToRefund) {
      const originalItem = transaction.items.find(i => i.id === refundItem.id)
      if (!originalItem) continue

      const refundQty = Math.min(refundItem.quantity, originalItem.quantity)
      refundAmount += (originalItem.unitPrice * refundQty)

      // Restore stock
      if (originalItem.productId) {
        await prisma.product.update({
          where: { id: originalItem.productId },
          data: {
            quantity: { increment: refundQty },
          },
        })

        // Create stock adjustment record
        const product = await prisma.product.findUnique({
          where: { id: originalItem.productId },
        })

        if (product) {
          await prisma.stockAdjustment.create({
            data: {
              productId: originalItem.productId,
              quantity: refundQty,
              type: "INCREASE",
              reason: `Refund from transaction ${transaction.transactionNo}: ${reason || 'No reason provided'}`,
              previousQty: product.quantity - refundQty,
              newQty: product.quantity,
              createdBy: session.user.id,
            },
          })
        }
      }
    }

    // Update transaction status
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "REFUNDED",
        notes: `${transaction.notes || ''}\n[REFUNDED] ${new Date().toISOString()}: ${reason || 'No reason provided'} - Amount: ${refundAmount}`,
      },
      include: {
        user: { select: { name: true } },
        items: true,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REFUND_TRANSACTION",
        entity: "TRANSACTION",
        entityId: transactionId,
        details: `Refunded transaction ${transaction.transactionNo}. Amount: ${refundAmount}. Reason: ${reason || 'Not specified'}`,
      },
    })

    return NextResponse.json({
      success: true,
      refundAmount,
      transaction: updatedTransaction,
    })
  } catch (error) {
    console.error("Process refund error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
