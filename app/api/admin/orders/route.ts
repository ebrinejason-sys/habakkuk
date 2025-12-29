import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF" && session.user.role !== "CEO")) {
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
      supplierOrders: orders.filter((o: any) => o.orderType === "SUPPLIER").length,
      customerOrders: orders.filter((o: any) => o.orderType === "CUSTOMER").length,
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
    const { customerId, customerName, customerPhone, orderType = "CUSTOMER", items, notes, deliveryAddress } = data

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items are required" }, { status: 400 })
    }

    // For CUSTOMER orders, we need either an existing customer or new customer info
    // For SUPPLIER orders, no customer is needed
    
    let finalCustomerId = customerId

    // If it's a customer order with no existing customer, create a new customer
    if (orderType === "CUSTOMER" && !customerId && customerName) {
      const newCustomer = await prisma.customer.create({
        data: {
          name: customerName,
          email: `${customerName.toLowerCase().replace(/\s+/g, '.')}@temp.local`,
          phone: customerPhone || null,
        },
      })
      finalCustomerId = newCustomer.id
    }

    // Calculate total amount and prepare order items
    let totalAmount = 0
    const orderItems = []

    for (const item of items) {
      const unitPrice = item.unitPrice || 0
      const totalPrice = unitPrice * item.quantity
      totalAmount += totalPrice

      // For CUSTOMER orders with productId, validate stock
      if (orderType === "CUSTOMER" && item.productId) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        })

        if (product && product.quantity < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` },
            { status: 400 }
          )
        }
      }

      orderItems.push({
        productId: item.productId || null,
        productName: item.productName || "",
        quantity: item.quantity,
        unitPrice: unitPrice,
        totalPrice,
      })
    }

    // Generate order number
    const prefix = orderType === "SUPPLIER" ? "REQ" : "ORD"
    const lastOrder = await prisma.order.findFirst({
      where: { orderNo: { startsWith: prefix } },
      orderBy: { createdAt: "desc" },
    })

    let orderNo = `${prefix}-0001`
    if (lastOrder && lastOrder.orderNo) {
      const lastNum = parseInt(lastOrder.orderNo.split("-")[1])
      orderNo = `${prefix}-${String(lastNum + 1).padStart(4, "0")}`
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNo,
        orderType: orderType as "CUSTOMER" | "SUPPLIER",
        customerId: finalCustomerId || null,
        totalAmount,
        status: "PENDING",
        paymentStatus: orderType === "SUPPLIER" ? "UNPAID" : "UNPAID",
        notes,
        deliveryAddress,
        items: {
          create: orderItems,
        },
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
        action: orderType === "SUPPLIER" ? "CREATE_SUPPLIER_ORDER" : "CREATE_CUSTOMER_ORDER",
        entity: "Order",
        entityId: order.id,
        details: orderType === "SUPPLIER" 
          ? `Created supplier requisition ${orderNo}` 
          : `Created customer order ${orderNo}${order.customer ? ` for ${order.customer.name}` : ""}`,
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
