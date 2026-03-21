/**
 * Build script for creating a standalone .exe with pre-populated database
 * 
 * Workflow:
 * 1. Ensure local SQLite DB is set up
 * 2. Sync data from cloud to local DB (optional — continues if fails)
 * 3. Build Next.js in standalone mode
 * 4. Copy static assets + public into standalone directory
 * 5. Copy Prisma client into standalone directory
 * 6. Package with electron-builder → dist/*.exe
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function runCommand(cmd, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`\n▶️  Running: ${cmd} ${args.join(' ')}`);

        const child = spawn(cmd, args, {
            stdio: 'inherit',
            shell: true,
            env: { ...process.env, ...options.env },
            cwd: options.cwd || PROJECT_ROOT,
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

// Recursively copy a directory
function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function generatePrismaClient() {
    console.log('\n🔧 Generating Prisma SQLite client...');
    await runCommand('npx', [
        'prisma', 'generate',
        '--schema=prisma/schema.sqlite.prisma',
    ]);
    console.log('✅ Prisma SQLite client generated at @prisma/client-sqlite');
}

async function ensureDatabaseExists() {
    const dbPath = path.join(PROJECT_ROOT, 'prisma', 'dev.db');

    if (!fs.existsSync(dbPath)) {
        console.log('\n📦 Database not found. Setting up SQLite...');
        await runCommand('npx', [
            'prisma', 'db', 'push',
            '--schema=prisma/schema.sqlite.prisma',
            '--accept-data-loss',
        ]);
    } else {
        const stats = fs.statSync(dbPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`\n✅ Database exists at prisma/dev.db (${sizeMB} MB)`);
    }
}

async function syncDataFromCloud() {
    console.log('\n🌐 Syncing data from cloud...');

    const syncUrl = process.env.SYNC_SERVER_URL;
    const syncKey = process.env.SYNC_API_KEY;

    if (!syncUrl || !syncKey) {
        console.log('⚠️  SYNC_SERVER_URL or SYNC_API_KEY not set. Skipping cloud sync.');
        console.log('   The app will use whatever data is currently in prisma/dev.db');
        return;
    }

    console.log(`   Server: ${syncUrl}`);

    try {
        const syncScript = path.join(PROJECT_ROOT, 'scripts', 'initial-sync.ts');
        await runCommand('npx', ['tsx', syncScript], {
            env: {
                NEXT_PUBLIC_IS_DESKTOP: 'true',
                DATABASE_URL: `file:${path.join(PROJECT_ROOT, 'prisma', 'dev.db')}`,
            }
        });
        console.log('✅ Sync complete');
    } catch (err) {
        console.error('\n⚠️  Sync failed. Continuing with existing local data...');
        console.error(`   Error: ${err.message}`);
    }
}

function updateTemplateDbFromDev() {
    const devDb = path.join(PROJECT_ROOT, 'prisma', 'dev.db');
    const templateDb = path.join(PROJECT_ROOT, 'prisma', 'template.db');

    if (!fs.existsSync(devDb)) {
        throw new Error('prisma/dev.db not found — cannot create template.db');
    }

    fs.copyFileSync(devDb, templateDb);
    const stats = fs.statSync(templateDb);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ prisma/template.db updated from dev.db (${sizeMB} MB)`);
}

async function buildNextJs() {
    console.log('\n🔨 Building Next.js for production (standalone mode)...');
    console.log('   Using Webpack bundler (more stable on Windows)');

    // Use --webpack to avoid Turbopack memory crashes on Windows
    // (Exit code 3221225477 / 0xC0000005 = Access Violation = OOM)
    await runCommand('node', [
        '--max-old-space-size=8192',
        'node_modules/next/dist/bin/next',
        'build',
        '--webpack',
    ], {
        env: {
            NEXT_PUBLIC_IS_DESKTOP: 'true',
            DATABASE_URL: `file:${path.join(PROJECT_ROOT, 'prisma', 'dev.db')}`,
        }
    });
}

function copyStandaloneAssets() {
    console.log('\n📂 Copying static assets into standalone directory...');

    const standaloneDir = path.join(PROJECT_ROOT, '.next', 'standalone');

    if (!fs.existsSync(standaloneDir)) {
        throw new Error(
            '.next/standalone directory not found!\n' +
            'Make sure next.config.ts has: output: "standalone"'
        );
    }

    // 1. Copy .next/static → .next/standalone/.next/static
    //    (Next.js standalone doesn't include static files by default)
    const staticSrc = path.join(PROJECT_ROOT, '.next', 'static');
    const staticDest = path.join(standaloneDir, '.next', 'static');
    if (fs.existsSync(staticSrc)) {
        console.log('   → Copying .next/static/');
        copyDirSync(staticSrc, staticDest);
    }

    // 2. Copy public/ → .next/standalone/public
    //    (Public assets like splash.html, logo, etc.)
    const publicSrc = path.join(PROJECT_ROOT, 'public');
    const publicDest = path.join(standaloneDir, 'public');
    if (fs.existsSync(publicSrc)) {
        console.log('   → Copying public/');
        copyDirSync(publicSrc, publicDest);
    }

    // 3. Copy Prisma schema + database into standalone
    const prismaSrc = path.join(PROJECT_ROOT, 'prisma');
    const prismaDest = path.join(standaloneDir, 'prisma');
    fs.mkdirSync(prismaDest, { recursive: true });

    const dbFile = path.join(prismaSrc, 'dev.db');
    if (fs.existsSync(dbFile)) {
        console.log('   → Copying prisma/dev.db');
        fs.copyFileSync(dbFile, path.join(prismaDest, 'dev.db'));
    }

    const schemaFile = path.join(prismaSrc, 'schema.sqlite.prisma');
    if (fs.existsSync(schemaFile)) {
        console.log('   → Copying prisma/schema.sqlite.prisma');
        fs.copyFileSync(schemaFile, path.join(prismaDest, 'schema.sqlite.prisma'));
    }

    // 4. Copy Prisma SQLite client into standalone's node_modules
    //    (The standalone build might not include the sqlite client we custom-generate)
    const prismaClientSqliteSrc = path.join(PROJECT_ROOT, 'node_modules', '@prisma', 'client-sqlite');
    const prismaClientSqliteDest = path.join(standaloneDir, 'node_modules', '@prisma', 'client-sqlite');
    if (fs.existsSync(prismaClientSqliteSrc)) {
        console.log('   → Copying @prisma/client-sqlite');
        copyDirSync(prismaClientSqliteSrc, prismaClientSqliteDest);
    }

    // 5. Copy Prisma engines (native SQLite query engine)
    const prismaEnginesSrc = path.join(PROJECT_ROOT, 'node_modules', '@prisma', 'engines');
    const prismaEnginesDest = path.join(standaloneDir, 'node_modules', '@prisma', 'engines');
    if (fs.existsSync(prismaEnginesSrc)) {
        console.log('   → Copying @prisma/engines');
        copyDirSync(prismaEnginesSrc, prismaEnginesDest);
    }

    // 6. Copy .prisma generated client (contains the query engine binary)
    const dotPrismaSrc = path.join(PROJECT_ROOT, 'node_modules', '.prisma');
    const dotPrismaDest = path.join(standaloneDir, 'node_modules', '.prisma');
    if (fs.existsSync(dotPrismaSrc)) {
        console.log('   → Copying .prisma (generated client)');
        copyDirSync(dotPrismaSrc, dotPrismaDest);
    }

    // 7. Copy @prisma/client (base client)
    const prismaClientSrc = path.join(PROJECT_ROOT, 'node_modules', '@prisma', 'client');
    const prismaClientDest = path.join(standaloneDir, 'node_modules', '@prisma', 'client');
    if (fs.existsSync(prismaClientSrc)) {
        console.log('   → Copying @prisma/client');
        copyDirSync(prismaClientSrc, prismaClientDest);
    }

    // 8. Copy .env
    const envFile = path.join(PROJECT_ROOT, '.env');
    if (fs.existsSync(envFile)) {
        console.log('   → Copying .env');
        fs.copyFileSync(envFile, path.join(standaloneDir, '.env'));
    }

    console.log('✅ All assets copied into standalone directory');
}

async function buildInstaller() {
    console.log('\n📦 Building Windows executable with electron-builder...');
    await runCommand('npx', [
        'electron-builder',
        '--win',
        '--x64',
        '--config', 'electron-builder.config.js',
    ]);
}

async function main() {
    console.log('=================================================');
    console.log('  Habakkuk Pharmacy — Build Standalone .exe');
    console.log('=================================================');
    console.log(`  Time: ${new Date().toLocaleString()}`);
    console.log('');

    // Load .env
    try {
        require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });
    } catch (e) {
        console.log('dotenv not found, reading .env manually...');
        const envPath = path.join(PROJECT_ROOT, '.env');
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx === -1) continue;
                const key = trimmed.slice(0, eqIdx).trim();
                const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
                if (!process.env[key]) process.env[key] = val;
            }
        }
    }

    try {
        // Step 1: Generate Prisma SQLite client
        console.log('\n━━━ Step 1/6: Generate Prisma Client ━━━');
        await generatePrismaClient();

        // Step 2: Ensure DB exists
        console.log('\n━━━ Step 2/6: Database ━━━');
        await ensureDatabaseExists();

        // Step 3: Sync latest data from cloud (optional)
        console.log('\n━━━ Step 3/6: Cloud Sync ━━━');
        await syncDataFromCloud();
        updateTemplateDbFromDev();

        // Step 4: Build Next.js (standalone mode)
        console.log('\n━━━ Step 4/6: Next.js Build ━━━');
        await buildNextJs();

        // Step 5: Copy assets into standalone
        console.log('\n━━━ Step 5/6: Copy Assets ━━━');
        copyStandaloneAssets();

        // Step 6: Build installer with electron-builder
        console.log('\n━━━ Step 6/6: Package .exe ━━━');
        await buildInstaller();

        console.log('\n=================================================');
        console.log('  ✅ BUILD COMPLETE!');
        console.log('=================================================');
        console.log('\n📁 Output location: dist/');
        console.log('');

        // List output files
        const distDir = path.join(PROJECT_ROOT, 'dist');
        if (fs.existsSync(distDir)) {
            const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe'));
            for (const file of files) {
                const stats = fs.statSync(path.join(distDir, file));
                const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                console.log(`   📦 ${file} (${sizeMB} MB)`);
            }
        }

        console.log('\n🚀 Give this .exe to anyone — they just double-click and go!');
        console.log('   No Node.js, no npm, no setup required.\n');

    } catch (err) {
        console.error('\n❌ Build failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
