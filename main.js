const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// ── App Configuration ───────────────────────────────────────────────────────
app.setName('Habakkuk Pharmacy POS');

let mainWindow;
let splashWindow;
let nextProcess;
const PORT = 3001;

// ── Resolve the app root (works in both dev and packaged mode) ───────────────
function getUnpackedRoot() {
    // This points to where Next.js code is (e.g., resources/app)
    return app.isPackaged ? app.getAppPath() : __dirname;
}

function getInstallRoot() {
    // This points to where extraResources are (e.g., next to the .exe)
    return app.isPackaged ? path.dirname(path.dirname(app.getAppPath())) : __dirname;
}

function getDatabasePath() {
    // For packaged apps, store in the system's AppData
    if (!app.isPackaged) return path.join(__dirname, 'prisma', 'dev.db');
    return path.join(app.getPath('userData'), 'database', 'dev.db');
}

// ── Load .env manually ──────────────────────────────────────────────────────
function loadEnv() {
    const installRoot = getInstallRoot();
    const envPath = path.join(installRoot, '.env');

    // Set default desktop flags before loading .env
    process.env.NEXT_PUBLIC_IS_DESKTOP = 'true';

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

    // Set DATABASE_URL to exactly where the database is stored
    const dbPath = getDatabasePath().replace(/\\/g, '/');
    process.env.DATABASE_URL = `file:///${dbPath}`;

    console.log(`[Desktop] Environment loaded. DB: ${process.env.DATABASE_URL}`);
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

    const installRoot = getInstallRoot();
    const splashPath = path.join(installRoot, 'public', 'splash.html');
    if (fs.existsSync(splashPath)) {
        splashWindow.loadFile(splashPath);
    } else {
        splashWindow.loadURL('data:text/html,<html><body style="display:flex;justify-content:center;align-items:center;height:100%;background:#1a1a2e;color:white;font-family:sans-serif;"><h2>Loading Habakkuk Pharmacy...</h2></body></html>');
    }
    splashWindow.center();
}

// ── Main Window ───────────────────────────────────────────────────────────────
function createMainWindow() {
    const installRoot = getInstallRoot();
    const iconPath = path.join(installRoot, 'public', 'logo.png');

    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        minWidth: 1024,
        minHeight: 600,
        show: false,
        icon: iconPath,
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

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) shell.openExternal(url);
        return { action: 'deny' };
    });
}

// ── Wait for Next.js, then load it ───────────────────────────────────────────
function waitForNextJs(callback, attempts = 0) {
    if (attempts > 90) {
        console.error('[Desktop] Next.js did not start after 90 seconds.');
        app.quit();
        return;
    }

    http.get(`http://localhost:${PORT}`, (res) => {
        if (res.statusCode < 500) {
            callback();
        } else {
            setTimeout(() => waitForNextJs(callback, attempts + 1), 1000);
        }
    }).on('error', () => {
        setTimeout(() => waitForNextJs(callback, attempts + 1), 1000);
    });
}

function resolveNodeRunnerPath() {
    const candidates = [
        process.execPath,
        app.getPath('exe'),
        path.join(getInstallRoot(), 'habakkuk-pharmacy-pos.exe'),
        path.join(getInstallRoot(), 'Habakkuk Pharmacy POS.exe'),
    ];

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return process.execPath;
}

// ── Start Next.js Server ─────────────────────────────────────────────────────
function startNextJsServer() {
    const unpackedRoot = getUnpackedRoot();
    const env = {
        ...process.env,
        PORT: PORT.toString(),
        HOSTNAME: '127.0.0.1',
        NEXT_PUBLIC_IS_DESKTOP: 'true',
        ELECTRON_RUN_AS_NODE: '1',
    };

    if (app.isPackaged) {
        const standaloneDir = path.join(unpackedRoot, '.next', 'standalone');
        const serverJs = path.join(standaloneDir, 'server.js');
        const runnerPath = resolveNodeRunnerPath();

        if (!fs.existsSync(serverJs)) {
            const { dialog } = require('electron');
            dialog.showErrorBox('Build Error', `Standalone server not found at:\n${serverJs}`);
            app.quit();
            return;
        }

        if (!fs.existsSync(runnerPath)) {
            const { dialog } = require('electron');
            dialog.showErrorBox('Next.js Start Error', `Runtime executable not found at:\n${runnerPath}`);
            app.quit();
            return;
        }

        const logPath = path.join(app.getPath('userData'), 'nextjs-error.log');
        const outStream = fs.createWriteStream(logPath, { flags: 'a' });

        console.log(`[Desktop] Starting Standalone server on port ${PORT} with runner: ${runnerPath}`);

        nextProcess = spawn(runnerPath, [serverJs], {
            cwd: standaloneDir,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (nextProcess.stdout) nextProcess.stdout.pipe(outStream);
        if (nextProcess.stderr) nextProcess.stderr.pipe(outStream);

        nextProcess.on('error', (err) => {
            const { dialog } = require('electron');
            dialog.showErrorBox('Next.js Start Error', err.message);
        });
    } else {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        nextProcess = spawn(npmCmd, ['run', 'dev'], {
            cwd: unpackedRoot,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
        });
    }

    if (nextProcess.stdout) {
        nextProcess.stdout.on('data', (d) => console.log(`[Next.js] ${d.toString().trim()}`));
    }
    if (nextProcess.stderr) {
        nextProcess.stderr.on('data', (d) => console.error(`[Next.js ERR] ${d.toString().trim()}`));
    }
}

// ── Background Sync ───────────────────────────────────────────────────────────
function startSyncWorker() {
    console.log('[Sync] Background sync worker started.');
    const doSync = () => {
        http.get(`http://localhost:${PORT}/api/sync/trigger`, (res) => {
            res.on('data', d => console.log('[Sync] Trigger:', d.toString().trim()));
        }).on('error', e => console.warn('[Sync] Server unreachable:', e.message));
    };
    setTimeout(doSync, 8000);
    setInterval(doSync, 30000);
}

// ── Initialization Logic ──────────────────────────────────────────────────────
function checkFirstRun() {
    const dbPath = getDatabasePath();
    const dbDir = path.dirname(dbPath);

    console.log(`[Desktop] Initializing. DB Target: ${dbPath}`);

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    if (!fs.existsSync(dbPath)) {
        console.log('[Desktop] Database not found. Copying template...');
        const installRoot = getInstallRoot();
        const templatePath = path.join(installRoot, 'prisma', 'template.db');

        try {
            if (fs.existsSync(templatePath)) {
                fs.copyFileSync(templatePath, dbPath);
                console.log('[Desktop] Template copied successfully.');
            } else {
                console.warn('[Desktop] CRITICAL: Template database not found at', templatePath);
            }
        } catch (copyErr) {
            console.error('[Desktop] Failed to copy template:', copyErr);
        }
    }

    createSplashWindow();
    createMainWindow();
    startNextJsServer();

    waitForNextJs(() => {
        console.log('[Desktop] Next.js ready. Loading portal...');
        mainWindow.loadURL(`http://localhost:${PORT}/login`);

        mainWindow.once('ready-to-show', () => {
            if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
            mainWindow.show();
            mainWindow.focus();
        });

        // Trigger first sync
        setTimeout(() => {
            console.log('[Sync] Triggering initial data fetch...');
            http.get(`http://localhost:${PORT}/api/sync/trigger?full=true`, () => { }).on('error', () => { });
        }, 10000);

        startSyncWorker();
    });
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.on('ready', () => {
        loadEnv();
        checkFirstRun();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('will-quit', () => {
        if (nextProcess) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', nextProcess.pid, '/f', '/t']);
            } else {
                nextProcess.kill('SIGTERM');
            }
        }
    });
}
