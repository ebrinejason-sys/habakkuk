const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow;
let splashWindow;
let nextProcess;
const PORT = 3001;

// ── Load .env manually (Electron doesn't pick it up automatically) ──────────
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.error('[Desktop] ERROR: .env file not found. Run scripts/setup-desktop.ps1 first.');
        return;
    }
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

// ── Splash Window ─────────────────────────────────────────────────────────────
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 480,
        height: 320,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        resizable: false,
        webPreferences: { nodeIntegration: false },
    });
    splashWindow.loadFile(path.join(__dirname, 'public', 'splash.html'));
    splashWindow.center();
}

// ── Main Window ───────────────────────────────────────────────────────────────
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        minWidth: 1024,
        minHeight: 600,
        show: false,  // Show only when Next.js is ready
        icon: path.join(__dirname, 'public', 'logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'default',
        title: 'Habakkuk Pharmacy',
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open external links in browser, not Electron
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) shell.openExternal(url);
        return { action: 'deny' };
    });
}

// ── Wait for Next.js, then load it ───────────────────────────────────────────
function waitForNextJs(callback, attempts = 0) {
    if (attempts > 60) {
        console.error('[Desktop] Next.js did not start after 60 seconds.');
        app.quit();
        return;
    }

    http.get(`http://localhost:${PORT}`, (res) => {
        if (res.statusCode < 500) {
            // Next.js is up
            callback();
        } else {
            setTimeout(() => waitForNextJs(callback, attempts + 1), 1000);
        }
    }).on('error', () => {
        // Not ready yet, keep trying
        setTimeout(() => waitForNextJs(callback, attempts + 1), 1000);
    });
}

// ── Start Next.js Server ─────────────────────────────────────────────────────
function startNextJsServer() {
    const env = {
        ...process.env,
        PORT: PORT.toString(),
        NEXT_PUBLIC_IS_DESKTOP: 'true',
        // DATABASE_URL already loaded from .env above
    };

    const serverCommand = app.isPackaged ? 'start' : 'dev';
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    console.log(`[Desktop] Starting Next.js in '${serverCommand}' mode on port ${PORT}...`);

    nextProcess = spawn(npmCmd, ['run', serverCommand], {
        cwd: __dirname,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    nextProcess.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.log(`[Next.js] ${msg}`);
    });
    nextProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.error(`[Next.js ERR] ${msg}`);
    });
    nextProcess.on('exit', (code) => {
        console.log(`[Next.js] Process exited with code ${code}`);
    });
}

// ── Background Sync (every 30s) ───────────────────────────────────────────────
function startSyncWorker() {
    console.log('[Sync] Background sync worker started.');

    const doSync = () => {
        http.get(`http://localhost:${PORT}/api/sync/trigger`, (res) => {
            res.on('data', (d) => {
                const msg = d.toString().trim();
                if (msg) console.log('[Sync] Trigger:', msg);
            });
        }).on('error', (e) => {
            console.warn('[Sync] Server not reachable:', e.message);
        });
    };

    // First sync at 8s (first-run will auto-detect and do full pull)
    setTimeout(doSync, 8000);
    // Then every 30s continuously
    setInterval(doSync, 30000);
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────
app.on('ready', () => {
    loadEnv();
    checkFirstRun();
});

function checkFirstRun() {
    // Check if local DB exists
    const dbPath = path.join(__dirname, 'prisma', 'dev.db');
    if (!fs.existsSync(dbPath)) {
        // Show a dialog telling user to run setup
        const { dialog } = require('electron');
        dialog.showMessageBoxSync({
            type: 'warning',
            title: 'First Run Setup Required',
            message: 'Local database not found.',
            detail: 'Please run the setup script first:\n\n  .\\scripts\\setup-desktop.ps1\n\nThen restart the app.',
            buttons: ['OK'],
        });
        app.quit();
        return;
    }

    createSplashWindow();
    createMainWindow();
    startNextJsServer();

    waitForNextJs(() => {
        console.log('[Desktop] Next.js is ready. Loading app...');
        mainWindow.loadURL(`http://localhost:${PORT}`);

        mainWindow.once('ready-to-show', () => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
                splashWindow = null;
            }
            mainWindow.show();
            mainWindow.focus();
        });

        startSyncWorker();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (nextProcess) {
        console.log('[Desktop] Shutting down Next.js...');
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', nextProcess.pid, '/f', '/t']);
        } else {
            nextProcess.kill('SIGTERM');
        }
    }
});
