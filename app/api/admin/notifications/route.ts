import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

// Get notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unread") === "true"
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = {
      userId: session.user.id,
    }

    if (unreadOnly) {
      where.isRead = false
    }

    const notifications = await (prisma as any).notification.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    })

    const unreadCount = await (prisma as any).notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    })

    return NextResponse.json({
      notifications,
      unreadCount,
    })
  } catch (error) {
    console.error("Get notifications error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { notificationIds, markAll } = await request.json()

    if (markAll) {
      await (prisma as any).notification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      })
    } else if (notificationIds && notificationIds.length > 0) {
      await (prisma as any).notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
        data: {
          isRead: true,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update notifications error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Delete old notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get("id")
    const cleanupOrphaned = searchParams.get("cleanup") === "true"

    if (notificationId) {
      await (prisma as any).notification.delete({
        where: {
          id: notificationId,
          userId: session.user.id,
        },
      })
    } else if (cleanupOrphaned) {
      // Clean up notifications for orders that are completed, cancelled, or deleted
      const orderNotifications = await (prisma as any).notification.findMany({
        where: {
          userId: session.user.id,
          type: { in: ["NEW_ORDER", "ORDER_CLAIMED"] },
          relatedId: { not: null },
        },
        select: { id: true, relatedId: true },
      })

      const orphanedIds: string[] = []

      for (const notification of orderNotifications) {
        if (notification.relatedId) {
          const order = await prisma.order.findUnique({
            where: { id: notification.relatedId },
            select: { id: true, status: true },
          })

          // Delete if order doesn't exist or is completed/cancelled
          if (!order || order.status === "COMPLETED" || order.status === "CANCELLED") {
            orphanedIds.push(notification.id)
          }
        }
      }

      if (orphanedIds.length > 0) {
        await (prisma as any).notification.deleteMany({
          where: {
            id: { in: orphanedIds },
          },
        })
      }

      return NextResponse.json({ 
        success: true, 
        cleaned: orphanedIds.length,
        message: `Cleaned up ${orphanedIds.length} orphaned notifications` 
      })
    } else {
      // Delete all read notifications older than 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      await (prisma as any).notification.deleteMany({
        where: {
          userId: session.user.id,
          isRead: true,
          createdAt: { lt: sevenDaysAgo },
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete notifications error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
