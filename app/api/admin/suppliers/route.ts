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

    const suppliers = await prisma.supplier.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { purchaseOrders: true }
        }
      }
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error("Get suppliers error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "CEO")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, email, phone, address, contactPerson, notes } = await request.json()

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      )
    }

    // Check if supplier with email already exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { email },
    })

    if (existingSupplier) {
      return NextResponse.json(
        { error: "Supplier with this email already exists" },
        { status: 400 }
      )
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        email,
        phone,
        address,
        contactPerson,
        notes,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_SUPPLIER",
        entity: "SUPPLIER",
        entityId: supplier.id,
        details: `Created supplier: ${name}`,
      },
    })

    return NextResponse.json({ success: true, supplier })
  } catch (error) {
    console.error("Create supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "CEO")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, name, email, phone, address, contactPerson, notes, isActive } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Supplier ID required" }, { status: 400 })
    }

    // Check if email is taken by another supplier
    if (email) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: { 
          email,
          NOT: { id }
        },
      })

      if (existingSupplier) {
        return NextResponse.json(
          { error: "Email is already used by another supplier" },
          { status: 400 }
        )
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        address,
        contactPerson,
        notes,
        isActive,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_SUPPLIER",
        entity: "SUPPLIER",
        entityId: supplier.id,
        details: `Updated supplier: ${name}`,
      },
    })

    return NextResponse.json({ success: true, supplier })
  } catch (error) {
    console.error("Update supplier error:", error)
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
    const supplierId = searchParams.get("id")

    if (!supplierId) {
      return NextResponse.json({ error: "Supplier ID required" }, { status: 400 })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { name: true }
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // Delete related purchase orders first
    await prisma.$transaction(async (tx: any) => {
      // Delete purchase order items
      await tx.purchaseOrderItem.deleteMany({
        where: {
          purchaseOrder: {
            supplierId: supplierId
          }
        }
      })

      // Delete purchase orders
      await tx.purchaseOrder.deleteMany({
        where: { supplierId: supplierId }
      })

      // Delete supplier
      await tx.supplier.delete({
        where: { id: supplierId }
      })
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_SUPPLIER",
        entity: "SUPPLIER",
        entityId: supplierId,
        details: `Deleted supplier: ${supplier.name}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete supplier error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
