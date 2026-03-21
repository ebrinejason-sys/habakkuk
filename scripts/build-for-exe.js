const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runBuild() {
    console.log('Building Habakkuk Pharmacy POS for executable...');
    
    // Clean previous build
    if (fs.existsSync('.next')) {
        fs.rmSync('.next', { recursive: true, force: true });
    }
    
    // Set environment variables
    process.env.NEXT_PUBLIC_IS_DESKTOP = 'true';
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    process.env.NODE_ENV = 'production';
    
    // Run Next.js build with turbopack disabled to avoid type generation issues
    return new Promise((resolve, reject) => {
        const build = spawn('npx', ['next', 'build'], {
            stdio: 'inherit',
            shell: true,
            env: process.env
        });
        
        build.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Build successful');
                resolve();
            } else {
                reject(new Error(`Build failed with code ${code}`));
            }
        });
    });
}

runBuild().catch(err => {
    console.error('Build error:', err);
    process.exit(1);
});
