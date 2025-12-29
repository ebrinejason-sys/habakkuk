import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../../auth/[...nextauth]/route"
import Papa from "papaparse"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const text = await file.text()

    // Parse CSV
    const results = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    })

    if (!results.data || results.data.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    const productsToCreate = []
    const errors = []

    for (const [index, row] of results.data.entries()) {
      const data: any = row

      // Validate required fields
      if (!data.name || !data.sku || !data.category || !data.price || !data.costPrice || !data.quantity) {
        errors.push(`Row ${index + 2}: Missing required fields`)
        continue
      }

      // Check for duplicate SKU in database
      const existingProduct = await prisma.product.findUnique({
        where: { sku: data.sku },
      })

      if (existingProduct) {
        errors.push(`Row ${index + 2}: SKU ${data.sku} already exists`)
        continue
      }

      productsToCreate.push({
        name: data.name,
        sku: data.sku,
        category: data.category,
        price: parseFloat(data.price),
        costPrice: parseFloat(data.costPrice),
        quantity: parseInt(data.quantity),
        reorderLevel: data.reorderLevel ? parseInt(data.reorderLevel) : 10,
        description: data.description || null,
      })
    }

    if (productsToCreate.length === 0) {
      return NextResponse.json(
        { error: "No valid products to create", details: errors },
        { status: 400 }
      )
    }

    // Create products
    const createdProducts = await prisma.product.createMany({
      data: productsToCreate,
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BULK_UPLOAD_PRODUCTS",
        entity: "PRODUCT",
        details: `Bulk uploaded ${createdProducts.count} products`,
      },
    })

    return NextResponse.json({
      success: true,
      count: createdProducts.count,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Bulk upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
