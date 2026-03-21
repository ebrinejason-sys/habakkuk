import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"
import { sendEmail } from "@/lib/email"

function generatePurchaseOrderNo(): string {
  const prefix = "PO"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get("supplierId")

    const where = supplierId ? { supplierId } : {}

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: {
          select: {
            name: true,
            email: true,
            phone: true,
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              }
            }
          }
        },
        _count: {
          select: { items: true }
        }
      }
    })

    return NextResponse.json(purchaseOrders)
  } catch (error) {
    console.error("Get purchase orders error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { supplierId, items, notes, expectedDate, sendEmailToSupplier } = await request.json()

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier and items are required" },
        { status: 400 }
      )
    }

    // Get supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0)

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        orderNo: generatePurchaseOrderNo(),
        supplierId,
        totalAmount,
        notes,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        createdBy: session.user.id,
        status: sendEmailToSupplier ? "SENT" : "DRAFT",
        emailSent: sendEmailToSupplier || false,
        emailSentAt: sendEmailToSupplier ? new Date() : null,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId || null,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          }))
        }
      },
      include: {
        supplier: true,
        items: true,
      }
    })

    // Send email to supplier if requested
    if (sendEmailToSupplier && supplier.email) {
      const itemsTable = purchaseOrder.items.map((item: any) => 
        `<tr>
          <td style="padding: 10px; border: 1px solid #ddd;">${item.productName}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">USh ${item.unitPrice.toLocaleString()}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">USh ${item.totalPrice.toLocaleString()}</td>
        </tr>`
      ).join('')

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Purchase Order</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">From Habakkuk Pharmacy</p>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
              <p>Dear ${supplier.contactPerson || supplier.name},</p>
              
              <p>We would like to place the following order:</p>
              
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Order Number:</strong> ${purchaseOrder.orderNo}</p>
                <p style="margin: 10px 0 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                ${expectedDate ? `<p style="margin: 10px 0 0;"><strong>Expected Delivery:</strong> ${new Date(expectedDate).toLocaleDateString()}</p>` : ''}
              </div>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background: #7c3aed; color: white;">
                    <th style="padding: 12px; text-align: left;">Product</th>
                    <th style="padding: 12px; text-align: center;">Quantity</th>
                    <th style="padding: 12px; text-align: right;">Unit Price</th>
                    <th style="padding: 12px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsTable}
                </tbody>
                <tfoot>
                  <tr style="background: #f3f4f6; font-weight: bold;">
                    <td colspan="3" style="padding: 12px; text-align: right;">Total Amount:</td>
                    <td style="padding: 12px; text-align: right;">USh ${totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
              
              ${notes ? `<div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Notes:</strong></p>
                <p style="margin: 5px 0 0;">${notes}</p>
              </div>` : ''}
              
              <p>Please confirm receipt of this order and provide an estimated delivery date.</p>
              
              <p>Thank you for your continued partnership.</p>
              
              <p>Best regards,<br>
              <strong>Habakkuk Pharmacy</strong></p>
            </div>
          </div>
          
          <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated message from Habakkuk Pharmacy System</p>
          </div>
        </div>
      `

      await sendEmail({
        to: supplier.email,
        subject: `Purchase Order ${purchaseOrder.orderNo} - Habakkuk Pharmacy`,
        html: emailHtml,
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_PURCHASE_ORDER",
        entity: "PURCHASE_ORDER",
        entityId: purchaseOrder.id,
        details: `Created PO ${purchaseOrder.orderNo} for ${supplier.name}${sendEmailToSupplier ? ' (email sent)' : ''}`,
      },
    })

    return NextResponse.json({ success: true, purchaseOrder })
  } catch (error) {
    console.error("Create purchase order error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, status, sendEmail: shouldSendEmail } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Purchase order ID required" }, { status: 400 })
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: true,
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }

    const updateData: any = {}
    if (status) updateData.status = status

    // If status is RECEIVED, update inventory
    if (status === "RECEIVED") {
      for (const item of purchaseOrder.items) {
        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              quantity: {
                increment: item.quantity
              }
            }
          })

          // Create stock adjustment record
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { quantity: true }
          })

          await prisma.stockAdjustment.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: "INCREASE",
              reason: `Received from PO ${purchaseOrder.orderNo}`,
              previousQty: (product?.quantity || 0) - item.quantity,
              newQty: product?.quantity || 0,
              createdBy: session.user.id,
            }
          })
        }
      }
    }

    // Send email if requested and not already sent
    if (shouldSendEmail && !purchaseOrder.emailSent && purchaseOrder.supplier.email) {
      const itemsTable = purchaseOrder.items.map((item: any) => 
        `<tr>
          <td style="padding: 10px; border: 1px solid #ddd;">${item.productName}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">USh ${item.unitPrice.toLocaleString()}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">USh ${item.totalPrice.toLocaleString()}</td>
        </tr>`
      ).join('')

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Purchase Order</h1>
          </div>
          <div style="padding: 30px;">
            <p>Dear ${purchaseOrder.supplier.contactPerson || purchaseOrder.supplier.name},</p>
            <p>Please find our purchase order details below:</p>
            <p><strong>Order Number:</strong> ${purchaseOrder.orderNo}</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background: #7c3aed; color: white;">
                  <th style="padding: 12px;">Product</th>
                  <th style="padding: 12px;">Quantity</th>
                  <th style="padding: 12px;">Unit Price</th>
                  <th style="padding: 12px;">Total</th>
                </tr>
              </thead>
              <tbody>${itemsTable}</tbody>
              <tfoot>
                <tr style="background: #f3f4f6; font-weight: bold;">
                  <td colspan="3" style="padding: 12px; text-align: right;">Total:</td>
                  <td style="padding: 12px;">USh ${purchaseOrder.totalAmount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
            <p>Best regards,<br>Habakkuk Pharmacy</p>
          </div>
        </div>
      `

      await sendEmail({
        to: purchaseOrder.supplier.email,
        subject: `Purchase Order ${purchaseOrder.orderNo} - Habakkuk Pharmacy`,
        html: emailHtml,
      })

      updateData.emailSent = true
      updateData.emailSentAt = new Date()
      updateData.status = "SENT"
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        items: true,
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_PURCHASE_ORDER",
        entity: "PURCHASE_ORDER",
        entityId: id,
        details: `Updated PO ${purchaseOrder.orderNo} status to ${status || updateData.status}`,
      },
    })

    return NextResponse.json({ success: true, purchaseOrder: updated })
  } catch (error) {
    console.error("Update purchase order error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
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
      return NextResponse.json({ error: "Purchase order ID required" }, { status: 400 })
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { orderNo: true, status: true }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }

    if (purchaseOrder.status === "RECEIVED") {
      return NextResponse.json(
        { error: "Cannot delete a received purchase order" },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id }
      })
      await tx.purchaseOrder.delete({
        where: { id }
      })
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_PURCHASE_ORDER",
        entity: "PURCHASE_ORDER",
        entityId: id,
        details: `Deleted PO ${purchaseOrder.orderNo}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete purchase order error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
