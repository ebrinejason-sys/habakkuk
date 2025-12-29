import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../../auth/[...nextauth]/route"
import { generateTransactionNo } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { items, paymentMethod } = await request.json()

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 })
    }

    // Calculate totals
    let totalAmount = 0
    const transactionItems = []

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        )
      }

      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        )
      }

      const itemTotal = item.unitPrice * item.quantity
      totalAmount += itemTotal

      transactionItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: itemTotal,
      })
    }

    // Get settings for tax
    const settings = await prisma.settings.findFirst()
    const taxRate = settings?.taxRate || 0
    const tax = totalAmount * (taxRate / 100)
    const netAmount = totalAmount + tax

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        transactionNo: generateTransactionNo(),
        userId: session.user.id,
        totalAmount,
        tax,
        netAmount,
        paymentMethod,
        status: "COMPLETED",
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    // Update product quantities
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      })

      // Create stock adjustment record
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      await prisma.stockAdjustment.create({
        data: {
          productId: item.productId,
          quantity: -item.quantity,
          type: "DECREASE",
          reason: `Sale - Transaction ${transaction.transactionNo}`,
          previousQty: product!.quantity + item.quantity,
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
