import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json()

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Identifier and password are required" },
        { status: 400 }
      )
    }

    const trimmedIdentifier = identifier.trim().toLowerCase()
    const isEmail = trimmedIdentifier.includes("@")

    // Find user by email or username
    let user
    if (isEmail) {
      user = await prisma.user.findUnique({
        where: { email: trimmedIdentifier },
        select: {
          id: true,
          email: true,
          password: true,
          twoFactorEnabled: true,
          isActive: true,
        },
      })
    } else {
      user = await prisma.user.findUnique({
        where: { username: trimmedIdentifier },
        select: {
          id: true,
          email: true,
          password: true,
          twoFactorEnabled: true,
          isActive: true,
        },
      })
    }

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Check if 2FA is enabled
    return NextResponse.json({
      requires2FA: user.twoFactorEnabled,
      email: user.email,
    })
  } catch (error) {
    console.error("Check 2FA error:", error)
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    )
  }
}
