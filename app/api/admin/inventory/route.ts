import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error("Get products error:", error)
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

    const data = await request.json()

    // Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku: data.sku },
    })

    if (existingProduct) {
      return NextResponse.json(
        { error: "Product with this SKU already exists" },
        { status: 400 }
      )
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        category: data.category,
        price: data.price,
        costPrice: data.costPrice,
        quantity: data.quantity,
        reorderLevel: data.reorderLevel || 10,
        description: data.description,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_PRODUCT",
        entity: "PRODUCT",
        entityId: product.id,
        details: `Created product: ${product.name} (${product.sku})`,
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Create product error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
