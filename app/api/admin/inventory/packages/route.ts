import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// GET packages for a product
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

        const packages = await prisma.productPackage.findMany({
            where: { productId },
            orderBy: { unitsPerPackage: "asc" },
        })

        return NextResponse.json(packages)
    } catch (error) {
        console.error("Get packages error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// POST - Create a new package
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const data = await request.json()

        if (!data.productId || !data.name || !data.unitsPerPackage || !data.price) {
            return NextResponse.json(
                { error: "Product ID, name, units per package, and price are required" },
                { status: 400 }
            )
        }

        // Check if package with same name already exists for this product
        const existing = await prisma.productPackage.findUnique({
            where: {
                productId_name: {
                    productId: data.productId,
                    name: data.name,
                },
            },
        })

        if (existing) {
            return NextResponse.json(
                { error: "A package with this name already exists for this product" },
                { status: 400 }
            )
        }

        const productPackage = await prisma.productPackage.create({
            data: {
                productId: data.productId,
                name: data.name,
                unitsPerPackage: data.unitsPerPackage,
                price: data.price,
                isDefault: data.isDefault || false,
            },
        })

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "CREATE_PACKAGE",
                entity: "PRODUCT_PACKAGE",
                entityId: productPackage.id,
                details: `Created package "${data.name}" (${data.unitsPerPackage} units) for product`,
            },
        })

        return NextResponse.json(productPackage)
    } catch (error) {
        console.error("Create package error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// PATCH - Update a package
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const data = await request.json()

        if (!data.id) {
            return NextResponse.json({ error: "Package ID is required" }, { status: 400 })
        }

        const productPackage = await prisma.productPackage.update({
            where: { id: data.id },
            data: {
                name: data.name,
                unitsPerPackage: data.unitsPerPackage,
                price: data.price,
                isDefault: data.isDefault,
            },
        })

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "UPDATE_PACKAGE",
                entity: "PRODUCT_PACKAGE",
                entityId: productPackage.id,
                details: `Updated package "${data.name}"`,
            },
        })

        return NextResponse.json(productPackage)
    } catch (error) {
        console.error("Update package error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// DELETE - Delete a package
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ error: "Package ID is required" }, { status: 400 })
        }

        const productPackage = await prisma.productPackage.delete({
            where: { id },
        })

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "DELETE_PACKAGE",
                entity: "PRODUCT_PACKAGE",
                entityId: id,
                details: `Deleted package "${productPackage.name}"`,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Delete package error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
