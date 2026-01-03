import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const hashedPassword = await bcrypt.hash('BBQs@uce@2002', 10)
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@habakkukpharmacy.com' },
    update: {
      password: hashedPassword,
      twoFactorEnabled: true,
      twoFactorEmail: 'ebrinetushabe@gmail.com',
      mustChangePassword: false,
    },
    create: {
      email: 'admin@habakkukpharmacy.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      permissions: [],
      isActive: true,
      mustChangePassword: false,
      twoFactorEnabled: true,
      twoFactorEmail: 'ebrinetushabe@gmail.com',
    },
  })

  console.log('✅ Created admin user with 2FA:', admin.email)

  // Create HABAKKUK master account for pharmacy PC
  const habakkukPassword = await bcrypt.hash('Habakkuk@2024', 10)
  
  const habakkuk = await prisma.user.upsert({
    where: { email: 'habakkuk@habakkukpharmacy.com' },
    update: {
      password: habakkukPassword,
      mustChangePassword: false,
    },
    create: {
      email: 'habakkuk@habakkukpharmacy.com',
      username: 'HABAKKUK',
      password: habakkukPassword,
      name: 'HABAKKUK',
      role: 'STAFF',
      permissions: ['MANAGE_POS', 'VIEW_TRANSACTIONS'],
      isActive: true,
      mustChangePassword: false,
      twoFactorEnabled: false,
    },
  })

  console.log('✅ Created HABAKKUK master account:', habakkuk.email)

  // Create default settings
  const settings = await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      pharmacyName: 'Habakkuk Pharmacy',
      location: 'Kampala, Uganda',
      contact: '+256 700 000000',
      email: 'info@habakkukpharmacy.com',
      footerText: 'Thank you for your purchase! Stay healthy.',
      currency: 'UGX',
      taxRate: 0,
      lowStockThreshold: 10,
    },
  })

  console.log('✅ Created settings:', settings.pharmacyName)

  // Create sample products
  const sampleProducts = [
    {
      name: 'Paracetamol 500mg',
      sku: 'PAR500',
      category: 'Pain Relief',
      price: 5000,
      costPrice: 3000,
      quantity: 100,
      reorderLevel: 20,
      description: 'Pain and fever relief',
    },
    {
      name: 'Ibuprofen 400mg',
      sku: 'IBU400',
      category: 'Pain Relief',
      price: 8000,
      costPrice: 5000,
      quantity: 150,
      reorderLevel: 25,
      description: 'Anti-inflammatory medication',
    },
    {
      name: 'Amoxicillin 250mg',
      sku: 'AMX250',
      category: 'Antibiotics',
      price: 15000,
      costPrice: 10000,
      quantity: 80,
      reorderLevel: 15,
      description: 'Antibiotic for bacterial infections',
    },
    {
      name: 'Vitamin C 1000mg',
      sku: 'VITC1000',
      category: 'Vitamins',
      price: 12000,
      costPrice: 8000,
      quantity: 200,
      reorderLevel: 30,
      description: 'Immune system support',
    },
    {
      name: 'Multivitamin Complex',
      sku: 'MULTI01',
      category: 'Vitamins',
      price: 25000,
      costPrice: 18000,
      quantity: 120,
      reorderLevel: 20,
      description: 'Complete multivitamin supplement',
    },
  ]

  for (const product of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    })
  }

  console.log('✅ Created sample products')

  console.log('🎉 Database seeded successfully!')
  console.log('\n📧 Admin Login:')
  console.log('   Email: admin@habakkukpharmacy.com')
  console.log('   Password: admin123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
