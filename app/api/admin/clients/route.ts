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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "10")

    let where: any = { isActive: true }
    
    if (search && search.trim()) {
      where = {
        ...where,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }
    }

    const clients = await prisma.client.findMany({
      where,
      take: limit,
      orderBy: { lastVisit: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        notes: true,
        lastVisit: true,
      },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error("Fetch clients error:", error)
    return NextResponse.json(
      { error: "Failed to fetch clients" },
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

    const { name, phone, address, notes } = await request.json()

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      )
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        lastVisit: new Date(),
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error("Create client error:", error)
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    )
  }
}
