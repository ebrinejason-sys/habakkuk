import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// GET batches for a product (ordered by expiry date for FIFO)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const productId = searchParams.get("productId")

        if (!productId) {
            return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
        }

        const batches = await prisma.productBatch.findMany({
            where: { productId, isActive: true },
            orderBy: { expiryDate: "asc" }, // FIFO: earliest expiry first
        })

        return NextResponse.json(batches)
    } catch (error) {
        console.error("Get batches error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// POST - Create a new batch
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const data = await request.json()

        if (!data.productId || !data.batchNumber || !data.quantity || !data.expiryDate) {
            return NextResponse.json(
                { error: "Product ID, batch number, quantity, and expiry date are required" },
                { status: 400 }
            )
        }

        // Check if batch with same number already exists for this product
        const existing = await prisma.productBatch.findUnique({
            where: {
                productId_batchNumber: {
                    productId: data.productId,
                    batchNumber: data.batchNumber,
                },
            },
        })

        if (existing) {
            return NextResponse.json(
                { error: "A batch with this number already exists for this product" },
                { status: 400 }
            )
        }

        // Get product to use its cost price if not provided
        const product = await prisma.product.findUnique({
            where: { id: data.productId },
        })

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 })
        }

        const batch = await prisma.productBatch.create({
            data: {
                productId: data.productId,
                batchNumber: data.batchNumber,
                quantity: data.quantity,
                initialQuantity: data.quantity,
                expiryDate: new Date(data.expiryDate),
                costPrice: data.costPrice || product.costPrice,
                notes: data.notes,
            },
        })

        // Update product total quantity
        await prisma.product.update({
            where: { id: data.productId },
            data: {
                quantity: { increment: data.quantity },
            },
        })

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "CREATE_BATCH",
                entity: "PRODUCT_BATCH",
                entityId: batch.id,
                details: `Created batch "${data.batchNumber}" with ${data.quantity} units, expires ${new Date(data.expiryDate).toLocaleDateString()}`,
            },
        })

        return NextResponse.json(batch)
    } catch (error) {
        console.error("Create batch error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// PATCH - Update a batch
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const data = await request.json()

        if (!data.id) {
            return NextResponse.json({ error: "Batch ID is required" }, { status: 400 })
        }

        const existingBatch = await prisma.productBatch.findUnique({
            where: { id: data.id },
        })

        if (!existingBatch) {
            return NextResponse.json({ error: "Batch not found" }, { status: 404 })
        }

        // Calculate quantity difference for product update
        const quantityDiff = (data.quantity !== undefined)
            ? data.quantity - existingBatch.quantity
            : 0

        const batch = await prisma.productBatch.update({
            where: { id: data.id },
            data: {
                quantity: data.quantity,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
                costPrice: data.costPrice,
                notes: data.notes,
                isActive: data.isActive,
            },
        })

        // Update product total quantity if quantity changed
        if (quantityDiff !== 0) {
            await prisma.product.update({
                where: { id: batch.productId },
                data: {
                    quantity: { increment: quantityDiff },
                },
            })
        }

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "UPDATE_BATCH",
                entity: "PRODUCT_BATCH",
                entityId: batch.id,
                details: `Updated batch "${batch.batchNumber}"`,
            },
        })

        return NextResponse.json(batch)
    } catch (error) {
        console.error("Update batch error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// DELETE - Deactivate a batch (soft delete)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ error: "Batch ID is required" }, { status: 400 })
        }

        const batch = await prisma.productBatch.update({
            where: { id },
            data: { isActive: false },
        })

        // Subtract remaining quantity from product total
        if (batch.quantity > 0) {
            await prisma.product.update({
                where: { id: batch.productId },
                data: {
                    quantity: { decrement: batch.quantity },
                },
            })
        }

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "DELETE_BATCH",
                entity: "PRODUCT_BATCH",
                entityId: id,
                details: `Deactivated batch "${batch.batchNumber}"`,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Delete batch error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
