import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../../auth/[...nextauth]/route"
import { generateTransactionNo } from "@/lib/utils"

interface CartItem {
  productId: string
  quantity: number // Always in base units
  unitPrice: number
  packageName?: string // "Strip", "Box", etc. - null for base unit sales
  packageQuantity?: number // Number of packages sold (e.g., 2 strips)
  batchId?: string // Specific batch to sell from (optional - FIFO if not specified)
}

// FIFO batch deduction - deducts from earliest expiring batches first
async function deductFromBatches(
  productId: string,
  quantityToDeduct: number,
  preferredBatchId?: string
): Promise<{ batchId: string; batchNumber: string; expiryDate: Date; costPrice: number; quantity: number }[]> {
  const deductions: { batchId: string; batchNumber: string; expiryDate: Date; costPrice: number; quantity: number }[] = []
  let remaining = quantityToDeduct

  // If a specific batch is preferred, try that first
  if (preferredBatchId) {
    const preferredBatch = await prisma.productBatch.findUnique({
      where: { id: preferredBatchId },
    })

    if (preferredBatch && preferredBatch.isActive && preferredBatch.quantity > 0) {
      const deductAmount = Math.min(remaining, preferredBatch.quantity)

      await prisma.productBatch.update({
        where: { id: preferredBatchId },
        data: { quantity: { decrement: deductAmount } },
      })

      deductions.push({
        batchId: preferredBatch.id,
        batchNumber: preferredBatch.batchNumber,
        expiryDate: preferredBatch.expiryDate,
        costPrice: preferredBatch.costPrice,
        quantity: deductAmount,
      })

      remaining -= deductAmount
    }
  }

  // FIFO: Get remaining batches ordered by expiry date (earliest first)
  if (remaining > 0) {
    const batches = await prisma.productBatch.findMany({
      where: {
        productId,
        isActive: true,
        quantity: { gt: 0 },
        ...(preferredBatchId ? { id: { not: preferredBatchId } } : {}),
      },
      orderBy: { expiryDate: "asc" },
    })

    for (const batch of batches) {
      if (remaining <= 0) break

      const deductAmount = Math.min(remaining, batch.quantity)

      await prisma.productBatch.update({
        where: { id: batch.id },
        data: { quantity: { decrement: deductAmount } },
      })

      deductions.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        costPrice: batch.costPrice,
        quantity: deductAmount,
      })

      remaining -= deductAmount
    }
  }

  return deductions
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { items, paymentMethod, staffId, staffName } = await request.json()

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 })
    }

    // Use provided staffId if given (for HABAKKUK master account), otherwise use session user
    const transactionUserId = staffId || session.user.id

    // Calculate totals and prepare transaction items
    let totalAmount = 0
    const transactionItems: any[] = []
    const batchDeductions: Map<string, { batchId: string; batchNumber: string; expiryDate: Date; costPrice: number; quantity: number }[]> = new Map()

    for (const item of items as CartItem[]) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          batches: {
            where: { isActive: true, quantity: { gt: 0 } },
            orderBy: { expiryDate: "asc" },
          },
        },
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        )
      }

      // Allow negative stock (Tally-style) - no stock validation
      // Stock will be decremented even if it goes negative

      const itemTotal = item.unitPrice * item.quantity
      totalAmount += itemTotal

      // Try FIFO batch deduction if batches exist
      let costPrice = product.costPrice
      let primaryBatchId: string | null = null

      if (product.batches.length > 0) {
        const deductions = await deductFromBatches(item.productId, item.quantity, item.batchId)
        batchDeductions.set(item.productId, deductions)

        if (deductions.length > 0) {
          // Use weighted average cost from batches
          const totalCost = deductions.reduce((sum, d) => sum + (d.costPrice * d.quantity), 0)
          costPrice = totalCost / item.quantity
          primaryBatchId = deductions[0].batchId
        }
      }

      transactionItems.push({
        productId: item.productId,
        batchId: primaryBatchId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: costPrice, // Store cost at time of sale for accurate profit calculation
        totalPrice: itemTotal,
        packageName: item.packageName || null,
        packageQuantity: item.packageQuantity || null,
      })
    }

    // Get settings for tax
    const settings = await prisma.settings.findFirst()
    const taxRate = settings?.taxRate || 0
    const tax = totalAmount * (taxRate / 100)
    const netAmount = totalAmount + tax

    // Create transaction - assigned to the actual staff member
    const transaction = await prisma.transaction.create({
      data: {
        transactionNo: generateTransactionNo(),
        userId: transactionUserId,
        totalAmount,
        tax,
        netAmount,
        paymentMethod,
        status: "COMPLETED",
        notes: staffName ? `Processed via HABAKKUK by ${staffName}` : null,
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: {
          include: {
            product: true,
            batch: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    })

    // Update product quantities (for products without batches or as total tracker)
    for (const item of items as CartItem[]) {
      const previousProduct = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      // Only decrement product quantity if no batch deductions occurred
      // (batch deductions are tracked separately, but we still update product total)
      const deductions = batchDeductions.get(item.productId)
      if (!deductions || deductions.length === 0) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        })
      }
      // Note: If batches exist, product.quantity is synced via batch API

      // Create stock adjustment record
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      await prisma.stockAdjustment.create({
        data: {
          productId: item.productId,
          quantity: -item.quantity,
          type: "DECREASE",
          reason: `Sale - Transaction ${transaction.transactionNo}${item.packageName ? ` (${item.packageQuantity} ${item.packageName})` : ''}`,
          previousQty: previousProduct!.quantity,
          newQty: product!.quantity,
          createdBy: session.user.id,
        },
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "COMPLETE_TRANSACTION",
        entity: "TRANSACTION",
        entityId: transaction.id,
        details: `Completed transaction ${transaction.transactionNo}`,
      },
    })

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error("Transaction error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
