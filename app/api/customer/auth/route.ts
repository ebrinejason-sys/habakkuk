import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, action } = await request.json()

    if (action === "register") {
      // Check if customer exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { email },
      })

      if (existingCustomer) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 400 }
        )
      }

      // Create customer
      const hashedPassword = await bcrypt.hash(password, 10)
      const customer = await prisma.customer.create({
        data: {
          email,
          name,
          password: hashedPassword,
        },
      })

      return NextResponse.json({ success: true })
    } else if (action === "login") {
      // Find customer
      const customer = await prisma.customer.findUnique({
        where: { email },
      })

      if (!customer || !customer.isActive) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        )
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, customer.password!)

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        )
      }

      return NextResponse.json({
        success: true,
        customerId: customer.id,
        name: customer.name,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Customer auth error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
