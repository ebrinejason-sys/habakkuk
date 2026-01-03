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
      where: {
        role: { not: "ADMIN" }, // Exclude admin users from list
      },
      select: {
        id: true,
        name: true,
        username: true,
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

    const { name, email, username, role, permissions } = await request.json()

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if user already exists by email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Check if username is already taken (if provided)
    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      })

      if (existingUsername) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        )
      }
    }

    // Generate password
    const password = generatePassword()
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username: username ? username.toLowerCase() : null,
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

    // Check if target user exists and is not admin
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    if (targetUser.role === "ADMIN") {
      return NextResponse.json(
        { error: "Admin accounts cannot be deleted" },
        { status: 403 }
      )
    }

    // Delete related records in order (due to foreign key constraints)
    // Use a transaction to ensure all deletions succeed or none
    await prisma.$transaction(async (tx) => {
      // Delete user's notifications
      await tx.notification.deleteMany({
        where: { userId: userId },
      })

      // Delete user's audit logs
      await tx.auditLog.deleteMany({
        where: { userId: userId },
      })

      // Update orders - remove user references but keep order data
      await tx.order.updateMany({
        where: { processedBy: userId },
        data: { processedBy: null },
      })

      await tx.order.updateMany({
        where: { claimedBy: userId },
        data: { claimedBy: null, claimedAt: null },
      })

      // For transactions, we need to keep the data for records
      // But Prisma requires userId, so we'll delete the user's transactions
      // or alternatively, you could reassign them to admin
      await tx.transaction.deleteMany({
        where: { userId: userId },
      })

      // Now delete the user
      await tx.user.delete({
        where: { id: userId },
      })
    })

    // Create audit log (with admin's ID since user is deleted)
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_USER",
        entity: "USER",
        entityId: userId,
        details: `Deleted user account: ${targetUser.name}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      { error: "Failed to delete user. Please try again." },
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

    const { id, name, username, role, permissions, isActive, resetPassword } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Handle password reset request
    if (resetPassword) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { name: true, email: true }
      })

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Generate new password
      const newPassword = generatePassword()
      const hashedPassword = await bcrypt.hash(newPassword, 10)

      // Update user with new password and require change
      await prisma.user.update({
        where: { id },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
        },
      })

      // Send password reset email
      const emailResult = await sendEmail({
        to: user.email,
        subject: "Password Reset - Habakkuk Pharmacy",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Password Reset</h2>
            <p>Hello ${user.name},</p>
            <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>New Password:</strong> ${newPassword}</p>
            </div>
            <p style="color: #dc2626;"><strong>Important:</strong> You will be required to change this password on your next login.</p>
            <p>Login at: <a href="https://habakkukpharmacy.com/login">https://habakkukpharmacy.com/login</a></p>
            <br>
            <p>Best regards,<br>Habakkuk Pharmacy</p>
          </div>
        `,
      })

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "RESET_PASSWORD",
          entity: "USER",
          entityId: id,
          details: `Reset password for user: ${user.name} (${user.email})`,
        },
      })

      return NextResponse.json({ 
        success: true, 
        message: "Password reset successfully. New credentials sent via email.",
        emailSent: emailResult.success
      })
    }

    // Check if username is already taken by another user (if provided)
    if (username) {
      const existingUsername = await prisma.user.findFirst({
        where: { 
          username: username.toLowerCase(),
          NOT: { id }
        },
      })

      if (existingUsername) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        )
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        username: username ? username.toLowerCase() : null,
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
