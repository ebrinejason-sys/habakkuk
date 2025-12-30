import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      )
    }

    // Normalize email to lowercase for consistent lookup
    const normalizedEmail = email.trim().toLowerCase()

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        twoFactorCode: true,
        twoFactorExpiry: true,
        twoFactorEnabled: true,
      },
    })

    if (!user || !user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      )
    }

    // Check if code exists
    if (!user.twoFactorCode || !user.twoFactorExpiry) {
      return NextResponse.json(
        { error: "No verification code found. Please request a new code." },
        { status: 400 }
      )
    }

    // Check if code is expired
    if (new Date() > user.twoFactorExpiry) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      )
    }

    // Verify code
    if (user.twoFactorCode !== code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      )
    }

    // Clear the code after successful verification
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCode: null,
        twoFactorExpiry: null,
      },
    })

    // Return user data for session creation
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        mustChangePassword: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "2FA verification successful",
      user: fullUser,
    })
  } catch (error) {
    console.error("2FA verify error:", error)
    return NextResponse.json(
      { error: "Failed to verify 2FA code" },
      { status: 500 }
    )
  }
}
