import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

// Claim an order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to claim orders
    const hasPermission =
      session.user.role === "ADMIN" ||
      session.user.role === "CEO" ||
      session.user.permissions?.includes("CLAIM_ORDERS" as any) ||
      session.user.permissions?.includes("MANAGE_POS")

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to claim orders" },
        { status: 403 }
      )
    }

    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    // Use a transaction to ensure atomic operation (first come, first served)
    const result = await prisma.$transaction(async (tx) => {
      // Check if order exists and is not already claimed
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true,
        },
      })

      if (!order) {
        throw new Error("ORDER_NOT_FOUND")
      }

      if ((order as any).claimedBy) {
        // Get the user who claimed it
        const claimedUser = await tx.user.findUnique({
          where: { id: (order as any).claimedBy },
          select: { name: true },
        })
        throw new Error(`ORDER_ALREADY_CLAIMED:${claimedUser?.name || "another user"}`)
      }

      if (order.status !== "PENDING") {
        throw new Error("ORDER_NOT_PENDING")
      }

      // Claim the order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          claimedBy: session.user.id,
          claimedAt: new Date(),
          status: "PROCESSING",
        } as any,
        include: {
          customer: true,
          items: true,
        },
      })

      // Delete all NEW_ORDER notifications for this order since it's been claimed
      // This removes the "New Customer Order" notification for all users
      try {
        await (tx as any).notification.deleteMany({
          where: {
            relatedId: orderId,
            type: "NEW_ORDER",
          },
        })
      } catch (e) {
        // Notification table might not exist yet
        console.log("Notification update skipped:", e)
      }

      // Notify other users that this order has been claimed
      const otherStaff = await tx.user.findMany({
        where: {
          isActive: true,
          id: { not: session.user.id },
          OR: [
            { role: "ADMIN" },
            { role: "CEO" },
            { role: "STAFF", permissions: { has: "CLAIM_ORDERS" as any } },
            { role: "STAFF", permissions: { has: "MANAGE_POS" } },
          ],
        },
      })

      // Create notifications for other staff about the claim
      const claimNotifications = otherStaff.map((user) => ({
        userId: user.id,
        type: "ORDER_CLAIMED" as const,
        title: "Order Claimed",
        message: `Order ${order.orderNo} has been claimed by ${session.user.name}`,
        relatedId: orderId,
      }))

      if (claimNotifications.length > 0) {
        try {
          await (tx as any).notification.createMany({
            data: claimNotifications,
          })
        } catch (e) {
          // Notification table might not exist yet
          console.log("Notification creation skipped:", e)
        }
      }

      return updatedOrder
    })

    // Send email notification to the customer
    if (result.customer?.email) {
      const settings = await prisma.settings.findFirst()
      try {
        await sendEmail({
          to: result.customer.email,
          subject: `Your Order ${result.orderNo} is Being Processed`,
          html: generateOrderClaimedEmail(
            result.customer.name,
            result.orderNo,
            session.user.name || "Staff",
            settings?.pharmacyName || "Habakkuk Pharmacy",
            settings?.contact || ""
          ),
        })
      } catch (emailError) {
        console.error("Failed to send customer email:", emailError)
      }
    }

    // Log the activity
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CLAIM_ORDER",
        entity: "Order",
        entityId: orderId,
        details: `Claimed order ${result.orderNo}`,
      },
    })

    return NextResponse.json({
      success: true,
      order: {
        id: result.id,
        orderNo: result.orderNo,
        status: result.status,
        claimedBy: session.user.name,
        claimedAt: (result as any).claimedAt,
      },
    })
  } catch (error: any) {
    console.error("Claim order error:", error)

    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (error.message?.startsWith("ORDER_ALREADY_CLAIMED:")) {
      const claimedBy = error.message.split(":")[1]
      return NextResponse.json(
        { error: `This order has already been claimed by ${claimedBy}` },
        { status: 409 }
      )
    }

    if (error.message === "ORDER_NOT_PENDING") {
      return NextResponse.json(
        { error: "Only pending orders can be claimed" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Unclaim an order (for admins or the user who claimed it)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("orderId")

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Only allow unclaim if user is admin/CEO or the one who claimed it
    const canUnclaim =
      session.user.role === "ADMIN" ||
      session.user.role === "CEO" ||
      (order as any).claimedBy === session.user.id

    if (!canUnclaim) {
      return NextResponse.json(
        { error: "You can only unclaim orders you claimed" },
        { status: 403 }
      )
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        claimedBy: null,
        claimedAt: null,
        status: "PENDING",
      } as any,
    })

    // Log the activity
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UNCLAIM_ORDER",
        entity: "Order",
        entityId: orderId,
        details: `Unclaimed order ${order.orderNo}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unclaim order error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

function generateOrderClaimedEmail(
  customerName: string,
  orderNo: string,
  staffName: string,
  pharmacyName: string,
  pharmacyContact: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .status-box { background-color: #D1FAE5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Order Update</h1>
        </div>
        <div class="content">
          <h2>Hello ${customerName},</h2>
          <p>Great news! Your order is now being processed.</p>
          
          <div class="status-box">
            <h3 style="margin: 0; color: #047857;">Order #${orderNo}</h3>
            <p style="margin: 10px 0 0 0; font-size: 18px; color: #059669;">
              <strong>Status: Processing</strong>
            </p>
          </div>
          
          <p><strong>${staffName}</strong> is now handling your order and will prepare it for you.</p>
          
          <p>We'll notify you once your order is ready for pickup or delivery.</p>
          
          ${pharmacyContact ? `<p>If you have any questions, please contact us at: <strong>${pharmacyContact}</strong></p>` : ""}
          
          <p>Thank you for choosing ${pharmacyName}!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${pharmacyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
