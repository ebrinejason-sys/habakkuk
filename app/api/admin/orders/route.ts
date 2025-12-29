import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                unitOfMeasure: true,
              },
            },
          },
        },
        processedByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const stats = {
      pending: orders.filter((o: typeof orders[0]) => o.status === "PENDING").length,
      completed: orders.filter((o: typeof orders[0]) => o.status === "COMPLETED").length,
      cancelled: orders.filter((o: typeof orders[0]) => o.status === "CANCELLED").length,
      totalRevenue: orders
        .filter((o: typeof orders[0]) => o.status === "COMPLETED")
        .reduce((sum: number, o: typeof orders[0]) => sum + o.totalAmount, 0),
    }

    return NextResponse.json({ orders, stats })
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()
    const { customerId, items, notes, deliveryAddress } = data

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json({ error: "Customer and items are required" }, { status: 400 })
    }

    // Validate stock availability
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 })
      }

      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` },
          { status: 400 }
        )
      }
    }

    // Calculate total amount
    let totalAmount = 0
    const orderItems = []

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      const totalPrice = product!.price * item.quantity
      totalAmount += totalPrice

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product!.price,
        totalPrice,
      })
    }

    // Generate order number
    const lastOrder = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
    })

    let orderNo = "ORD-0001"
    if (lastOrder && lastOrder.orderNo) {
      const lastNum = parseInt(lastOrder.orderNo.split("-")[1])
      orderNo = `ORD-${String(lastNum + 1).padStart(4, "0")}`
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId,
        totalAmount,
        status: "PENDING",
        notes,
        deliveryAddress,
        items: {
          create: orderItems,
        },
        createdByUserId: session.user.id,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_ORDER",
        entity: "Order",
        entityId: order.id,
        details: `Created order ${orderNo} for ${order.customer.name}`,
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error("Error creating order:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()
    const { id, status } = data

    if (!id || !status) {
      return NextResponse.json({ error: "Order ID and status are required" }, { status: 400 })
    }

    if (!["PENDING", "COMPLETED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
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

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status,
        processedBy: status !== "PENDING" ? session.user.id : null,
      },
    })

    // If completing order, create transaction and update stock
    if (status === "COMPLETED") {
      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          transactionNo: `TXN-${Date.now()}`,
          customerId: order.customerId,
          totalAmount: order.totalAmount,
          netAmount: order.totalAmount,
          paymentMethod: "CASH",
          userId: session.user.id,
          items: {
            create: order.items.map((item: { productId: string; quantity: number; unitPrice: number; totalPrice: number }) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
      })

      // Update stock
      for (const item of order.items) {
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
            reason: `Order ${order.orderNo} completed`,
            previousQty: product?.quantity || 0,
            newQty: (product?.quantity || 0) - item.quantity,
            createdBy: session.user.id,
          },
        })
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_ORDER",
        entity: "Order",
        entityId: order.id,
        details: `Changed status to ${status}`,
      },
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error("Error updating order:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete completed orders" },
        { status: 400 }
      )
    }

    // Delete order items first
    await prisma.orderItem.deleteMany({
      where: { orderId: id },
    })

    // Delete order
    await prisma.order.delete({
      where: { id },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_ORDER",
        entity: "Order",
        entityId: id,
        details: `Deleted order ${order.orderNo}`,
      },
    })

    return NextResponse.json({ message: "Order deleted successfully" })
  } catch (error) {
    console.error("Error deleting order:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
