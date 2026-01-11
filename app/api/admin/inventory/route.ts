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
      include: {
        packages: {
          orderBy: { unitsPerPackage: "asc" },
        },
        batches: {
          where: { isActive: true, quantity: { gt: 0 } },
          orderBy: { expiryDate: "asc" }, // FIFO: earliest expiry first
        },
      },
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

    // Create product with packages and batches in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the product
      const product = await tx.product.create({
        data: {
          name: data.name,
          sku: data.sku,
          barcode: data.barcode,
          category: data.category || "General",
          price: data.price,
          costPrice: data.costPrice,
          quantity: data.quantity || 0,
          reorderLevel: data.reorderLevel || 10,
          unitOfMeasure: data.unitOfMeasure || "Tablet",
          description: data.description,
          manufacturer: data.manufacturer,
        },
      })

      // Create packages if provided
      if (data.packages && Array.isArray(data.packages) && data.packages.length > 0) {
        await tx.productPackage.createMany({
          data: data.packages.map((pkg: any) => ({
            productId: product.id,
            name: pkg.name,
            unitsPerPackage: pkg.unitsPerPackage,
            price: pkg.price,
          })),
        })
      }

      // Create batches if provided
      if (data.batches && Array.isArray(data.batches) && data.batches.length > 0) {
        await tx.productBatch.createMany({
          data: data.batches.map((batch: any) => ({
            productId: product.id,
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            initialQuantity: batch.quantity,
            expiryDate: new Date(batch.expiryDate),
            costPrice: batch.costPrice || data.costPrice,
          })),
        })

        // Update product quantity to sum of batch quantities
        const totalBatchQty = data.batches.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0)
        if (totalBatchQty > 0) {
          await tx.product.update({
            where: { id: product.id },
            data: { quantity: totalBatchQty },
          })
        }
      }

      return product
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_PRODUCT",
        entity: "PRODUCT",
        entityId: result.id,
        details: `Created product: ${result.name} (${result.sku}) with ${data.packages?.length || 0} packages, ${data.batches?.length || 0} batches`,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Create product error:", error)
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

    const data = await request.json()

    if (!data.id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: data.id },
    })

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Update product with packages and batches in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the product
      const product = await tx.product.update({
        where: { id: data.id },
        data: {
          name: data.name,
          barcode: data.barcode,
          category: data.category || "General",
          price: data.price,
          costPrice: data.costPrice,
          quantity: data.quantity,
          reorderLevel: data.reorderLevel || 10,
          unitOfMeasure: data.unitOfMeasure || "Tablet",
          description: data.description,
          manufacturer: data.manufacturer,
        },
      })

      // Delete removed packages
      if (data.deletedPackageIds && Array.isArray(data.deletedPackageIds) && data.deletedPackageIds.length > 0) {
        await tx.productPackage.deleteMany({
          where: { id: { in: data.deletedPackageIds } },
        })
      }

      // Delete removed batches (soft delete by setting isActive = false)
      if (data.deletedBatchIds && Array.isArray(data.deletedBatchIds) && data.deletedBatchIds.length > 0) {
        await tx.productBatch.updateMany({
          where: { id: { in: data.deletedBatchIds } },
          data: { isActive: false },
        })
      }

      // Handle packages: update existing, create new
      if (data.packages && Array.isArray(data.packages)) {
        for (const pkg of data.packages) {
          if (pkg.id) {
            // Update existing package
            await tx.productPackage.update({
              where: { id: pkg.id },
              data: {
                name: pkg.name,
                unitsPerPackage: pkg.unitsPerPackage,
                price: pkg.price,
              },
            })
          } else {
            // Create new package
            await tx.productPackage.create({
              data: {
                productId: product.id,
                name: pkg.name,
                unitsPerPackage: pkg.unitsPerPackage,
                price: pkg.price,
              },
            })
          }
        }
      }

      // Handle batches: update existing, create new
      if (data.batches && Array.isArray(data.batches)) {
        for (const batch of data.batches) {
          if (batch.id) {
            // Update existing batch
            await tx.productBatch.update({
              where: { id: batch.id },
              data: {
                batchNumber: batch.batchNumber,
                quantity: batch.quantity,
                expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : undefined,
                costPrice: batch.costPrice,
              },
            })
          } else {
            // Create new batch
            await tx.productBatch.create({
              data: {
                productId: product.id,
                batchNumber: batch.batchNumber,
                quantity: batch.quantity,
                initialQuantity: batch.quantity,
                expiryDate: new Date(batch.expiryDate),
                costPrice: batch.costPrice || data.costPrice,
              },
            })
          }
        }
      }

      return product
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_PRODUCT",
        entity: "PRODUCT",
        entityId: result.id,
        details: `Updated product: ${result.name} (${result.sku})`,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Update product error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
