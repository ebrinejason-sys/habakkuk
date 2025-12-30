import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

// Get customer's orders
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get("x-customer-id")

    if (!customerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      where: {
        customerId,
        isOnlineOrder: true,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
        },
        claimedByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error("Get customer orders error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Place a new order
export async function POST(request: NextRequest) {
  try {
    const customerId = request.headers.get("x-customer-id")

    if (!customerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { items, notes, deliveryAddress } = await request.json()

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items are required" }, { status: 400 })
    }

    // Get customer info
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer || !customer.isActive) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Validate products and calculate total
    let totalAmount = 0
    const orderItems = []

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 400 }
        )
      }

      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` },
          { status: 400 }
        )
      }

      const totalPrice = product.price * item.quantity
      totalAmount += totalPrice

      orderItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice,
      })
    }

    // Generate order number
    const lastOrder = await prisma.order.findFirst({
      where: { orderNo: { startsWith: "ONLINE" } },
      orderBy: { createdAt: "desc" },
    })

    let orderNo = "ONLINE-0001"
    if (lastOrder && lastOrder.orderNo) {
      const lastNum = parseInt(lastOrder.orderNo.split("-")[1])
      orderNo = `ONLINE-${String(lastNum + 1).padStart(4, "0")}`
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId,
        orderType: "CUSTOMER",
        totalAmount,
        status: "PENDING",
        paymentStatus: "UNPAID",
        notes,
        deliveryAddress: deliveryAddress || customer.address,
        isOnlineOrder: true,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    })

    // Notify all active staff users about the new order
    const staffUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: "ADMIN" },
          { role: "CEO" },
          { role: "STAFF", permissions: { has: "CLAIM_ORDERS" as any } },
          { role: "STAFF", permissions: { has: "MANAGE_POS" } },
        ],
      },
    })

    // Create in-app notifications for all eligible staff
    const notifications = staffUsers.map((user) => ({
      userId: user.id,
      type: "NEW_ORDER" as const,
      title: "New Customer Order",
      message: `New online order ${orderNo} from ${customer.name} for ${formatCurrency(totalAmount)}`,
      relatedId: order.id,
    }))

    if (notifications.length > 0) {
      try {
        await (prisma as any).notification.createMany({
          data: notifications,
        })
      } catch (e) {
        // Notification table might not exist yet
        console.log("Notification creation skipped:", e)
      }
    }

    // Send email notifications to staff
    const settings = await prisma.settings.findFirst()
    for (const user of staffUsers) {
      try {
        await sendEmail({
          to: user.email,
          subject: `New Customer Order: ${orderNo}`,
          html: generateNewOrderEmail(
            user.name,
            orderNo,
            customer.name,
            totalAmount,
            orderItems,
            settings?.pharmacyName || "Habakkuk Pharmacy"
          ),
        })
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError)
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNo: order.orderNo,
        totalAmount: order.totalAmount,
        status: order.status,
      },
    })
  } catch (error) {
    console.error("Place order error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount)
}

function generateNewOrderEmail(
  staffName: string,
  orderNo: string,
  customerName: string,
  totalAmount: number,
  items: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number }>,
  pharmacyName: string
): string {
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.productName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.totalPrice)}</td>
      </tr>
    `
    )
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .order-details { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #4F46E5; color: white; padding: 10px; text-align: left; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .highlight { background-color: #FEF3C7; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 New Customer Order</h1>
        </div>
        <div class="content">
          <h2>Hello ${staffName},</h2>
          <p>A new customer order has been placed and is waiting to be claimed.</p>
          
          <div class="highlight">
            <strong>⚡ First come, first served!</strong> Claim this order now to process it.
          </div>
          
          <div class="order-details">
            <h3>Order Details:</h3>
            <p><strong>Order #:</strong> ${orderNo}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Total Amount:</strong> ${formatCurrency(totalAmount)}</p>
          </div>
          
          <h4>Order Items:</h4>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/portal/orders" class="button">View & Claim Order</a>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This order will be assigned to the first staff member who claims it.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${pharmacyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
