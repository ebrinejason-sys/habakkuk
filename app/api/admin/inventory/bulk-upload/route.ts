import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../../auth/[...nextauth]/route"
import Papa from "papaparse"
import * as XLSX from "xlsx"

// Helper function to find value from multiple possible column names
function getFieldValue(data: any, ...possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase()
    // Check all keys case-insensitively
    for (const key of Object.keys(data)) {
      if (key.toLowerCase() === lowerName || key.toLowerCase().includes(lowerName)) {
        const value = data[key]
        if (value !== undefined && value !== null && value !== "") {
          return String(value).trim()
        }
      }
    }
  }
  return null
}

// Helper to parse number, handling commas and currency symbols
function parseNumber(value: string | null): number {
  if (!value) return 0
  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[₹$,\s]/g, "").trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// Helper to generate SKU from product name if not provided
function generateSKU(name: string, index: number): string {
  const prefix = name
    .split(" ")
    .slice(0, 2)
    .map(word => word.substring(0, 3).toUpperCase())
    .join("")
  return `${prefix}-${Date.now()}-${index}`
}

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

    const fileName = file.name.toLowerCase()
    let parsedData: any[] = []

    // Handle both CSV and Excel files
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      // Parse Excel file
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: "" })
      console.log("Excel headers:", Object.keys(parsedData[0] || {}))
    } else {
      // Parse CSV file
      const text = await file.text()
      console.log("File content preview:", text.substring(0, 500))
      
      const results = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      })
      parsedData = results.data as any[]
      console.log("CSV headers:", results.meta.fields)
    }

    console.log("Parsed data count:", parsedData.length)
    if (parsedData.length > 0) {
      console.log("Sample row:", JSON.stringify(parsedData[0]))
    }

    if (!parsedData || parsedData.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    const productsToCreate: Array<{
      name: string
      sku: string
      barcode: string | null
      category: string
      price: number
      costPrice: number
      quantity: number
      reorderLevel: number
      unitOfMeasure: string
      description: string | null
      batchNumber: string | null
      manufacturer: string | null
      expiryDate: Date | null
    }> = []
    const errors: string[] = []
    const skippedDuplicates: string[] = []

    for (const [index, data] of parsedData.entries()) {
      // Map Tally and other common column names to our fields
      // Name variations: Name, Item Name, Stock Item, Product Name, Particulars, Description
      const name = getFieldValue(data, 
        "name", "item name", "stock item", "product name", "particulars", 
        "item", "product", "medicine name", "drug name", "description"
      )

      // SKU variations: SKU, Part No, Item Code, Product Code, HSN Code, Code
      let sku = getFieldValue(data, 
        "sku", "part no", "part number", "item code", "product code", 
        "hsn code", "hsn", "code", "barcode", "item no"
      )

      // Category variations: Category, Group, Under, Item Group, Product Group
      const category = getFieldValue(data, 
        "category", "group", "under", "item group", "product group", 
        "stock group", "type", "classification"
      ) || "General"

      // Price variations: Price, Rate, Selling Price, MRP, Sale Rate, Sales Price
      const priceStr = getFieldValue(data, 
        "price", "rate", "selling price", "mrp", "sale rate", "sales price",
        "retail price", "sp", "selling rate", "unit price"
      )

      // Cost Price variations: Cost Price, Purchase Price, Cost, Purchase Rate, CP
      const costPriceStr = getFieldValue(data, 
        "costprice", "cost price", "purchase price", "cost", "purchase rate",
        "cp", "buying price", "purchase cost", "landed cost"
      )

      // Quantity variations: Quantity, Qty, Stock, Closing Stock, Balance, Opening Stock
      const quantityStr = getFieldValue(data, 
        "quantity", "qty", "stock", "closing stock", "balance", 
        "opening stock", "stock qty", "available", "in stock", "closing balance"
      )

      // Barcode
      const barcode = getFieldValue(data, "barcode", "bar code", "upc", "ean") || null

      // Unit variations
      const unitOfMeasure = getFieldValue(data, 
        "unit", "unitofmeasure", "uom", "unit of measure", "base unit"
      ) || "Unit"

      // Batch number
      const batchNumber = getFieldValue(data, 
        "batchnumber", "batch number", "batch no", "batch", "lot number", "lot no"
      ) || null

      // Manufacturer
      const manufacturer = getFieldValue(data, 
        "manufacturer", "mfg", "brand", "company", "make", "supplier"
      ) || null

      // Expiry date
      const expiryDateStr = getFieldValue(data, 
        "expirydate", "expiry date", "expiry", "exp date", "exp", "best before"
      )

      // Description
      const description = getFieldValue(data, 
        "description", "remarks", "notes", "details", "narration"
      ) || null

      // Reorder level
      const reorderLevelStr = getFieldValue(data, 
        "reorderlevel", "reorder level", "reorder", "min stock", "minimum stock"
      )

      // Skip empty rows
      if (!name) {
        continue
      }

      // Generate SKU if not provided
      if (!sku) {
        sku = generateSKU(name, index)
      }

      // Parse numeric values
      const price = parseNumber(priceStr)
      const costPrice = parseNumber(costPriceStr) || price * 0.7 // Default to 70% of price if not provided
      const quantity = Math.round(parseNumber(quantityStr)) || 0
      const reorderLevel = Math.round(parseNumber(reorderLevelStr)) || 10

      // Validate minimum required data
      if (price <= 0 && costPrice <= 0) {
        errors.push(`Row ${index + 2}: "${name}" - No valid price found`)
        continue
      }

      // Check for duplicate SKU in database
      const existingProduct = await prisma.product.findUnique({
        where: { sku: sku },
      })

      if (existingProduct) {
        skippedDuplicates.push(`Row ${index + 2}: SKU "${sku}" already exists (${name})`)
        continue
      }

      // Check for duplicate SKU in current batch
      const duplicateInBatch = productsToCreate.find(p => p.sku === sku)
      if (duplicateInBatch) {
        sku = `${sku}-${index}` // Make unique
      }

      // Parse expiry date
      let expiryDate: Date | null = null
      if (expiryDateStr) {
        try {
          expiryDate = new Date(expiryDateStr)
          if (isNaN(expiryDate.getTime())) {
            expiryDate = null
          }
        } catch {
          expiryDate = null
        }
      }

      productsToCreate.push({
        name: name,
        sku: sku,
        barcode: barcode,
        category: category,
        price: price > 0 ? price : costPrice * 1.3, // Default markup if no price
        costPrice: costPrice > 0 ? costPrice : price * 0.7,
        quantity: quantity,
        reorderLevel: reorderLevel,
        unitOfMeasure: unitOfMeasure,
        description: description,
        batchNumber: batchNumber,
        manufacturer: manufacturer,
        expiryDate: expiryDate,
      })
    }

    if (productsToCreate.length === 0) {
      return NextResponse.json(
        { 
          error: "No valid products to create", 
          details: errors,
          skipped: skippedDuplicates,
          hint: "Make sure your file has columns for: Name (or Item Name), Price (or Rate/MRP), and optionally Quantity, Category, etc."
        },
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
      skipped: skippedDuplicates.length > 0 ? skippedDuplicates : undefined,
    })
  } catch (error) {
    console.error("Bulk upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
