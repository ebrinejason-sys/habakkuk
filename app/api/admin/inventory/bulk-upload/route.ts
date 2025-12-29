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
    console.log("File content preview:", text.substring(0, 500))

    // Parse CSV
    const results = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase(),
    })

    console.log("Parsed headers:", results.meta.fields)
    console.log("Parsed data count:", results.data.length)

    if (!results.data || results.data.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    const productsToCreate = []
    const errors = []

    for (const [index, row] of results.data.entries()) {
      const data: any = row

      // Validate required fields (case-insensitive)
      const name = data.name || data.Name
      const sku = data.sku || data.SKU
      const category = data.category || data.Category
      const price = data.price || data.Price
      const costPrice = data.costprice || data.costPrice || data.CostPrice
      const quantity = data.quantity || data.Quantity
      const barcode = data.barcode || data.Barcode || null
      const reorderLevel = data.reorderlevel || data.reorderLevel || data.ReorderLevel
      const unitOfMeasure = data.unitofmeasure || data.unitOfMeasure || data.UnitOfMeasure || "Unit"
      const description = data.description || data.Description || null
      const batchNumber = data.batchnumber || data.batchNumber || data.BatchNumber || null
      const manufacturer = data.manufacturer || data.Manufacturer || null
      const expiryDate = data.expirydate || data.expiryDate || data.ExpiryDate || null

      if (!name || !sku || !category || !price || !costPrice || !quantity) {
        errors.push(`Row ${index + 2}: Missing required fields (name: ${!!name}, sku: ${!!sku}, category: ${!!category}, price: ${!!price}, costPrice: ${!!costPrice}, quantity: ${!!quantity})`)
        continue
      }

      // Check for duplicate SKU in database
      const existingProduct = await prisma.product.findUnique({
        where: { sku: sku },
      })

      if (existingProduct) {
        errors.push(`Row ${index + 2}: SKU ${sku} already exists`)
        continue
      }

      productsToCreate.push({
        name: name,
        sku: sku,
        barcode: barcode,
        category: category,
        price: parseFloat(price),
        costPrice: parseFloat(costPrice),
        quantity: parseInt(quantity),
        reorderLevel: reorderLevel ? parseInt(reorderLevel) : 10,
        unitOfMeasure: unitOfMeasure,
        description: description,
        batchNumber: batchNumber,
        manufacturer: manufacturer,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
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
