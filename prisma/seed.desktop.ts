/**
 * Desktop Seed — initializes the local SQLite database with:
 * - Admin user
 * - HABAKKUK staff user
 * - Default settings
 * - Sample products
 * 
 * Note: SQLite schema uses permissions as a comma-separated String, not an array.
 */
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client-sqlite'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding desktop SQLite database...')

    // Admin user
    const adminPassword = await bcrypt.hash('BBQs@uce@2002', 10)
    await prisma.user.upsert({
        where: { email: 'admin@habakkukpharmacy.com' },
        update: {
            password: adminPassword,
            mustChangePassword: false,
        },
        create: {
            email: 'admin@habakkukpharmacy.com',
            password: adminPassword,
            name: 'Admin User',
            role: 'ADMIN',
            permissions: '',
            isActive: true,
            mustChangePassword: false,
            twoFactorEnabled: false,  // Disable 2FA for desktop local mode
        },
    })
    console.log('✅ Admin user created')

    // HABAKKUK POS staff user
    const habakkukPassword = await bcrypt.hash('Habakkuk@2024', 10)
    await prisma.user.upsert({
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
            permissions: 'MANAGE_POS,VIEW_TRANSACTIONS',
            isActive: true,
            mustChangePassword: false,
            twoFactorEnabled: false,
        },
    })
    console.log('✅ HABAKKUK staff account created')

    // Default settings
    await prisma.settings.upsert({
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
    console.log('✅ Settings created')

    // Sample products
    const products = [
        { name: 'Paracetamol 500mg', sku: 'PAR500', category: 'Pain Relief', price: 5000, costPrice: 3000, quantity: 100, reorderLevel: 20, description: 'Pain and fever relief' },
        { name: 'Ibuprofen 400mg', sku: 'IBU400', category: 'Pain Relief', price: 8000, costPrice: 5000, quantity: 150, reorderLevel: 25, description: 'Anti-inflammatory' },
        { name: 'Amoxicillin 250mg', sku: 'AMX250', category: 'Antibiotics', price: 15000, costPrice: 10000, quantity: 80, reorderLevel: 15, description: 'Antibiotic' },
        { name: 'Vitamin C 1000mg', sku: 'VITC1000', category: 'Vitamins', price: 12000, costPrice: 8000, quantity: 200, reorderLevel: 30, description: 'Immune support' },
        { name: 'Multivitamin Complex', sku: 'MULTI01', category: 'Vitamins', price: 25000, costPrice: 18000, quantity: 120, reorderLevel: 20, description: 'Complete multivitamin' },
    ]

    for (const p of products) {
        await prisma.product.upsert({ where: { sku: p.sku }, update: {}, create: p })
    }
    console.log('✅ Sample products created')

    console.log('\n🎉 Desktop database seeded!')
    console.log('─────────────────────────────')
    console.log('  Admin: admin@habakkukpharmacy.com')
    console.log('  Pass:  BBQs@uce@2002')
    console.log('  Staff: HABAKKUK / Habakkuk@2024')
    console.log('─────────────────────────────')
}

main()
    .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
