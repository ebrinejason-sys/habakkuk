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

    const settings = await prisma.settings.findFirst()

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Get settings error:", error)
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

    const data = await request.json()

    const existingSettings = await prisma.settings.findFirst()

    let settings
    if (existingSettings) {
      settings = await prisma.settings.update({
        where: { id: existingSettings.id },
        data: {
          pharmacyName: data.pharmacyName,
          location: data.location,
          contact: data.contact,
          email: data.email,
          logo: data.logo,
          footerText: data.footerText,
          currency: data.currency,
          taxRate: data.taxRate,
        },
      })
    } else {
      settings = await prisma.settings.create({
        data: {
          pharmacyName: data.pharmacyName,
          location: data.location,
          contact: data.contact,
          email: data.email,
          logo: data.logo,
          footerText: data.footerText || "",
          currency: data.currency || "UGX",
          taxRate: data.taxRate || 0,
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_SETTINGS",
        entity: "SETTINGS",
        entityId: settings.id,
        details: "Updated pharmacy settings",
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Save settings error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
