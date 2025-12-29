import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authOptions } from "../../auth/[...nextauth]/route"
import { sendEmail, generateWelcomeEmail } from "@/lib/email"
import { generatePassword } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, email, role, permissions } = await request.json()

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Generate password
    const password = generatePassword()
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        permissions: role === "ADMIN" ? [] : permissions || [],
        mustChangePassword: true,
        createdBy: session.user.id,
      },
    })

    // Send welcome email
    const emailResult = await sendEmail({
      to: email,
      subject: "Welcome to Habakkuk Pharmacy - Your Account Details",
      html: generateWelcomeEmail(name, email, password, role),
    })

    if (!emailResult.success) {
      console.error("Failed to send welcome email:", emailResult.error)
      // We don't fail the request if email fails, but log it
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_USER",
        entity: "USER",
        entityId: user.id,
        details: `Created user: ${name} (${email})`,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Create user error:", error)
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
    const userId = searchParams.get("id")

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      )
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_USER",
        entity: "USER",
        entityId: userId,
        details: "Deleted user account",
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, name, role, permissions, isActive } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        role,
        permissions: role === "ADMIN" ? [] : permissions || [],
        isActive,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_USER",
        entity: "USER",
        entityId: user.id,
        details: `Updated user: ${name}`,
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
