/**
 * Copies schema.sqlite.prisma → schema.prisma for desktop/SQLite mode.
 * Called by: npm run db:desktop:setup
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'prisma', 'schema.sqlite.prisma');
const dest = path.join(__dirname, '..', 'prisma', 'schema.prisma');

if (!fs.existsSync(src)) {
    console.error('ERROR: prisma/schema.sqlite.prisma not found!');
    process.exit(1);
}

fs.copyFileSync(src, dest);
console.log('✅ SQLite schema activated (schema.sqlite.prisma → schema.prisma)');
