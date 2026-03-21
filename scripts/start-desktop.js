const { spawn } = require('child_process');
const path = require('path');

console.log('[Desktop Launcher] Scrubbing VS Code environment variables...');

// Copy existing environment
const env = { ...process.env };

// 🚨 CRITICAL FIX for VS Code Terminals 🚨
// VS Code injects this, which forces Electron to run as a headless Node.js CLI
// instead of launching the Chromium browser window. We MUST delete it completely.
delete env.ELECTRON_RUN_AS_NODE;

// Spawn the Electron binary directly from local node_modules
// This avoids npx which might re-inject environment variables
const electronPath = process.platform === 'win32'
    ? path.join(__dirname, '..', 'node_modules', '.bin', 'electron.cmd')
    : path.join(__dirname, '..', 'node_modules', '.bin', 'electron');

const child = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    shell: true,
    env
});

child.on('exit', (code) => {
    process.exit(code);
});
