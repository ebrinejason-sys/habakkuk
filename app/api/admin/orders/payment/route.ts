import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()
    const { orderId, paymentMethod = "CASH" } = data

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ error: "Order already paid" }, { status: 400 })
    }

    if (order.orderType === "SUPPLIER") {
      return NextResponse.json({ error: "Supplier orders cannot be processed as transactions" }, { status: 400 })
    }

    // Validate stock availability before processing
    for (const item of order.items) {
      if (item.productId) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        })

        if (!product) {
          return NextResponse.json({ error: `Product not found: ${item.productName}` }, { status: 400 })
        }

        if (product.quantity < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` },
            { status: 400 }
          )
        }
      }
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        transactionNo: `TXN-${Date.now()}`,
        customerId: order.customerId,
        totalAmount: order.totalAmount,
        netAmount: order.totalAmount,
        paymentMethod: paymentMethod as "CASH" | "CARD" | "MOBILE_MONEY" | "BANK_TRANSFER",
        userId: session.user.id,
        items: {
          create: order.items
            .filter((item: any) => item.productId)
            .map((item: { productId: string | null; quantity: number; unitPrice: number; totalPrice: number }) => ({
              productId: item.productId!,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
        },
      },
    })

    // Update stock for items with productId
    for (const item of order.items) {
      if (item.productId) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        })
        
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        })

        // Log stock adjustment
        await prisma.stockAdjustment.create({
          data: {
            productId: item.productId,
            quantity: -item.quantity,
            type: "DECREASE",
            reason: `Order ${order.orderNo} payment processed`,
            previousQty: product?.quantity || 0,
            newQty: (product?.quantity || 0) - item.quantity,
            createdBy: session.user.id,
          },
        })
      }
    }

    // Update order status and payment status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        paymentStatus: "PAID",
        processedBy: session.user.id,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PROCESS_PAYMENT",
        entity: "Order",
        entityId: orderId,
        details: `Processed payment for order ${order.orderNo}. Transaction: ${transaction.transactionNo}`,
      },
    })

    return NextResponse.json({
      message: "Payment processed successfully",
      transaction,
    })
  } catch (error) {
    console.error("Error processing payment:", error)
    return NextResponse.json({ error: "Failed to process payment" }, { status: 500 })
  }
}
