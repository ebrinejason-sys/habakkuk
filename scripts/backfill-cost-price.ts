import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillCostPrice() {
    console.log('🔄 Backfilling costPrice for old TransactionItems...')

    // Get all transaction items without costPrice
    const items = await prisma.transactionItem.findMany({
        where: { costPrice: null },
        include: { product: { select: { costPrice: true, name: true } } }
    })

    console.log(`📊 Found ${items.length} items to update`)

    if (items.length === 0) {
        console.log('✅ All items already have costPrice!')
        await prisma.$disconnect()
        return
    }

    let updated = 0
    for (const item of items) {
        await prisma.transactionItem.update({
            where: { id: item.id },
            data: { costPrice: item.product.costPrice }
        })
        updated++
        if (updated % 50 === 0) {
            console.log(`   Updated ${updated}/${items.length}...`)
        }
    }

    console.log(`✅ Successfully updated ${updated} items with costPrice`)
    await prisma.$disconnect()
}

backfillCostPrice().catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
})
