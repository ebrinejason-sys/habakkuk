import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../../auth/[...nextauth]/route"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { productId, quantity, type, reason, batchNumber, expiryDate } = await request.json()

    if (!productId || !quantity || !type) {
      return NextResponse.json(
        { error: "Product ID, quantity, and type are required" },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const previousQty = product.quantity
    let newQty: number

    if (type === "INCREASE") {
      newQty = previousQty + quantity
    } else if (type === "DECREASE") {
      newQty = Math.max(0, previousQty - quantity)
    } else if (type === "CORRECTION") {
      newQty = quantity
    } else {
      return NextResponse.json({ error: "Invalid adjustment type" }, { status: 400 })
    }

    // Prepare update data
    const updateData: any = { quantity: newQty }
    
    // Update batch number and expiry date if provided
    if (batchNumber !== undefined) {
      updateData.batchNumber = batchNumber || null
    }
    if (expiryDate !== undefined) {
      updateData.expiryDate = expiryDate ? new Date(expiryDate) : null
    }

    // Update product quantity and optionally batch/expiry
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    })

    // Create stock adjustment record
    await prisma.stockAdjustment.create({
      data: {
        productId,
        quantity,
        type,
        reason: reason || `Stock ${type.toLowerCase()}`,
        previousQty,
        newQty,
        createdBy: session.user.id,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "STOCK_ADJUSTMENT",
        entity: "PRODUCT",
        entityId: productId,
        details: `Stock ${type}: ${product.name} - Previous: ${previousQty}, Added: ${quantity}, New: ${newQty}`,
      },
    })

    return NextResponse.json({
      product: updatedProduct,
      adjustment: {
        previousQty,
        quantity,
        newQty,
        type,
      },
    })
  } catch (error) {
    console.error("Stock update error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
