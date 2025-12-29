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
