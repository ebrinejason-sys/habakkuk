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

    const customers = await prisma.customer.findMany({
      include: {
        _count: {
          select: {
            orders: true,
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error("Get customers error:", error)
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

    const { name, email, phone, address } = await request.json()

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Customer with this email already exists" },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone,
        address,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_CUSTOMER",
        entity: "CUSTOMER",
        entityId: customer.id,
        details: `Created customer: ${name} (${email})`,
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Create customer error:", error)
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

    const { id, name, email, phone, address, isActive } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Customer ID required" }, { status: 400 })
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        address,
        isActive,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_CUSTOMER",
        entity: "CUSTOMER",
        entityId: customer.id,
        details: `Updated customer: ${name}`,
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Update customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("id")

    if (!customerId) {
      return NextResponse.json({ error: "Customer ID required" }, { status: 400 })
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id: customerId },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_CUSTOMER",
        entity: "CUSTOMER",
        entityId: customerId,
        details: "Deleted customer account",
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete customer error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
