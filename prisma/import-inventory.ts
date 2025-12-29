/**
 * Import Full Inventory from STOCK.xls into Database
 * 
 * This script imports all 1082 products from the parsed inventory
 * into the Prisma database.
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface ProductData {
  name: string;
  description: string;
  category: string;
  sku: string;
  price: number;
  costPrice: number;
  quantity: number;
  reorderLevel: number;
  unitOfMeasure: string;
  manufacturer: string | null;
  batchNumber: string | null;
  isActive: boolean;
}

async function main() {
  console.log('🏥 HABAKKUK PHARMACY - INVENTORY IMPORT')
  console.log('='.repeat(50))
  
  // Read the parsed inventory
  const inventoryPath = path.join(__dirname, 'full_inventory.json')
  
  if (!fs.existsSync(inventoryPath)) {
    console.error('❌ full_inventory.json not found!')
    console.log('   Run: npx tsx scripts/parse-full-inventory.ts first')
    process.exit(1)
  }
  
  const products: ProductData[] = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'))
  console.log(`📦 Found ${products.length} products to import\n`)
  
  // Clear existing products (optional - comment out if you want to keep existing)
  console.log('🗑️  Clearing existing products...')
  await prisma.transactionItem.deleteMany({})
  await prisma.orderItem.deleteMany({})
  await prisma.stockAdjustment.deleteMany({})
  await prisma.product.deleteMany({})
  console.log('   Done\n')
  
  // Import products in batches
  const batchSize = 100
  let imported = 0
  let errors = 0
  const errorProducts: { name: string; error: string }[] = []
  
  console.log('📥 Importing products...')
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize)
    
    for (const product of batch) {
      try {
        await prisma.product.create({
          data: {
            name: product.name,
            description: product.description,
            category: product.category,
            sku: product.sku,
            price: product.price,
            costPrice: product.costPrice,
            quantity: product.quantity,
            reorderLevel: product.reorderLevel,
            unitOfMeasure: product.unitOfMeasure,
            manufacturer: product.manufacturer,
            batchNumber: product.batchNumber,
            isActive: product.isActive,
          }
        })
        imported++
      } catch (error: any) {
        errors++
        errorProducts.push({
          name: product.name,
          error: error.message?.substring(0, 100) || 'Unknown error'
        })
      }
    }
    
    // Progress update
    const progress = Math.min(i + batchSize, products.length)
    process.stdout.write(`   Progress: ${progress}/${products.length} (${Math.round(progress/products.length*100)}%)\r`)
  }
  
  console.log('\n')
  console.log('='.repeat(50))
  console.log('📊 IMPORT SUMMARY')
  console.log('='.repeat(50))
  console.log(`✅ Successfully imported: ${imported} products`)
  console.log(`❌ Errors: ${errors} products`)
  
  if (errors > 0) {
    console.log('\n⚠️  Failed products:')
    for (const err of errorProducts.slice(0, 10)) {
      console.log(`   - ${err.name}: ${err.error}`)
    }
    if (errorProducts.length > 10) {
      console.log(`   ... and ${errorProducts.length - 10} more`)
    }
  }
  
  // Get counts by category
  const categoryCounts = await prisma.product.groupBy({
    by: ['category'],
    _count: true,
    orderBy: {
      _count: {
        category: 'desc'
      }
    }
  })
  
  console.log('\n📁 Products by Category:')
  for (const cat of categoryCounts) {
    console.log(`   ${cat.category.padEnd(35)} | ${cat._count} products`)
  }
  
  // Stock status
  const totalProducts = await prisma.product.count()
  const positiveStock = await prisma.product.count({ where: { quantity: { gt: 0 } } })
  const negativeStock = await prisma.product.count({ where: { quantity: { lt: 0 } } })
  const zeroStock = await prisma.product.count({ where: { quantity: 0 } })
  
  console.log('\n📦 Stock Status:')
  console.log(`   Total products: ${totalProducts}`)
  console.log(`   With stock (>0): ${positiveStock}`)
  console.log(`   Zero stock: ${zeroStock}`)
  console.log(`   Negative stock: ${negativeStock}`)
  
  console.log('\n🎉 Import completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error importing inventory:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
