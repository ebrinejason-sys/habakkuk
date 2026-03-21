import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

interface EditItemRequest {
    id: string
    quantity: number
    unitPrice: number
}

interface EditTransactionRequest {
    items: EditItemRequest[]
    paymentMethod: string
    reason: string
    discount?: number
}

// Edit a transaction and send priority notifications to CEO/ADMIN
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const body: EditTransactionRequest = await request.json()

        // Validate reason is provided and not empty
        if (!body.reason || body.reason.trim().length < 10) {
            return NextResponse.json(
                { error: "A reason for editing is required (minimum 10 characters)" },
                { status: 400 }
            )
        }

        // Get existing transaction with items
        const existingTransaction = await prisma.transaction.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                user: {
                    select: { name: true },
                },
            },
        })

        if (!existingTransaction) {
            return NextResponse.json(
                { error: "Transaction not found" },
                { status: 404 }
            )
        }

        // Create snapshot of previous data
        const previousData = JSON.stringify(existingTransaction)

        // Get settings for tax calculation
        const settings = await prisma.settings.findFirst()
        const taxRate = settings?.taxRate || 0

        // Process stock adjustments for quantity changes
        for (const editItem of body.items) {
            const existingItem = existingTransaction.items.find(
                (item: any) => item.id === editItem.id
            )

            if (!existingItem) continue

            const quantityDiff = editItem.quantity - existingItem.quantity

            if (quantityDiff !== 0) {
                // Get current product stock
                const product = await prisma.product.findUnique({
                    where: { id: existingItem.productId },
                })

                if (product) {
                    // Adjust stock (negative quantityDiff means returning stock, positive means more sold)
                    await prisma.product.update({
                        where: { id: existingItem.productId },
                        data: {
                            quantity: {
                                decrement: quantityDiff,
                            },
                        },
                    })

                    // Create stock adjustment record
                    await prisma.stockAdjustment.create({
                        data: {
                            productId: existingItem.productId,
                            quantity: -quantityDiff,
                            type: quantityDiff > 0 ? "DECREASE" : "INCREASE",
                            reason: `Transaction Edit - ${existingTransaction.transactionNo}: ${body.reason}`,
                            previousQty: product.quantity,
                            newQty: product.quantity - quantityDiff,
                            createdBy: session.user.id,
                        },
                    })
                }
            }
        }

        // Calculate new totals
        let newTotalAmount = 0
        const updatedItems = body.items.map((editItem) => {
            const totalPrice = editItem.unitPrice * editItem.quantity
            newTotalAmount += totalPrice
            return {
                id: editItem.id,
                quantity: editItem.quantity,
                unitPrice: editItem.unitPrice,
                totalPrice,
            }
        })

        const discount = body.discount ?? existingTransaction.discount
        const newTax = (newTotalAmount - discount) * (taxRate / 100)
        const newNetAmount = newTotalAmount - discount + newTax

        // Update transaction items
        for (const item of updatedItems) {
            await prisma.transactionItem.update({
                where: { id: item.id },
                data: {
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                },
            })
        }

        // Update transaction
        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                totalAmount: newTotalAmount,
                discount,
                tax: newTax,
                netAmount: newNetAmount,
                paymentMethod: body.paymentMethod as any,
                isEdited: true,
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                sku: true,
                                costPrice: true,
                                expiryDate: true,
                                batchNumber: true,
                            },
                        },
                    },
                },
                user: {
                    select: { name: true },
                },
            },
        })

        // Create snapshot of new data
        const newData = JSON.stringify(updatedTransaction)

        // Create TransactionEdit record
        await prisma.transactionEdit.create({
            data: {
                transactionId: id,
                editedBy: session.user.id,
                reason: body.reason.trim(),
                previousData,
                newData,
            },
        })

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "EDIT_TRANSACTION",
                entity: "TRANSACTION",
                entityId: id,
                details: `Edited transaction ${existingTransaction.transactionNo}. Reason: ${body.reason}`,
            },
        })

        // Send priority notifications to ALL CEO and ADMIN users
        const ceoAndAdminUsers = await prisma.user.findMany({
            where: {
                role: { in: ["CEO", "ADMIN"] },
                isActive: true,
            },
            select: { id: true },
        })

        const editorName = session.user.name || session.user.email

        // Create notifications for all CEO/ADMIN users
        await prisma.notification.createMany({
            data: ceoAndAdminUsers.map((user: any) => ({
                userId: user.id,
                type: "TRANSACTION_EDIT" as const,
                title: "⚠️ Transaction Edited",
                message: `${editorName} edited transaction ${existingTransaction.transactionNo}. Reason: ${body.reason}`,
                relatedId: id,
                isRead: false,
            })),
        })

        return NextResponse.json({
            success: true,
            transaction: updatedTransaction,
            message: "Transaction updated successfully",
        })
    } catch (error) {
        console.error("Edit transaction error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// Get transaction edit history
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params

        const edits = await prisma.transactionEdit.findMany({
            where: { transactionId: id },
            include: {
                editor: {
                    select: { name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ edits })
    } catch (error) {
        console.error("Get transaction edits error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
