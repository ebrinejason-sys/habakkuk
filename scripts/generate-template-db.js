const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DB = path.join(PROJECT_ROOT, 'prisma', 'template.db');

async function createTemplate() {
    console.log('Generating empty template database...');

    if (fs.existsSync(TEMPLATE_DB)) {
        fs.unlinkSync(TEMPLATE_DB);
    }

    return new Promise((resolve, reject) => {
        const child = spawn('npx', [
            'prisma', 'db', 'push',
            '--schema=schema.sqlite.prisma',
            '--accept-data-loss'
        ], {
            stdio: 'inherit',
            shell: true,
            env: {
                ...process.env,
                DATABASE_URL: `file:./template.db`
            },
            cwd: path.join(PROJECT_ROOT, 'prisma'),
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log('✅ template.db created successfully.');
                resolve();
            } else {
                reject(new Error(`Failed with code ${code}`));
            }
        });
    });
}

createTemplate().catch(err => {
    console.error(err);
    process.exit(1);
});
