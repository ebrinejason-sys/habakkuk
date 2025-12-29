import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        quantity: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        price: true,
        quantity: true,
        description: true,
      },
      orderBy: { name: "asc" },
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
