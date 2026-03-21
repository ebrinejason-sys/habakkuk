/**
 * Electron Builder Configuration
 * 
 * Packages the Habakkuk Pharmacy POS as a standalone Windows executable.
 * Uses the Next.js standalone output — all node_modules are bundled.
 * The target PC needs ZERO installs (no Node.js, no npm).
 */

module.exports = {
    appId: 'com.habakkukpharmacy.pos',
    productName: 'Habakkuk Pharmacy POS',
    copyright: 'Copyright © 2025 Habakkuk Pharmacy',

    // Don't use asar — standalone server needs real file access for Prisma
    asar: false,

    directories: {
        output: 'dist',
        buildResources: 'build-resources',
    },

    files: [
        // ── Electron entry point ──
        'main.js',
        'package.json',

        // ── Next.js standalone output (self-contained server + deps) ──
        '.next/standalone/**/*',

        // ── Next.js static assets (not included in standalone by default) ──
        '.next/static/**/*',

        // ── Public assets (splash screen, icons, etc.) ──
        'public/**/*',

        // ── Prisma files ──
        'prisma/schema.sqlite.prisma',
        'prisma/template.db',

        // ── Environment config ──
        '.env',

        // ── Prisma client + SQLite engine (needed at runtime) ──
        'node_modules/@prisma/client-sqlite/**/*',
        'node_modules/@prisma/engines/**/*',
        'node_modules/.prisma/**/*',

        // ── Exclude unnecessary files to reduce size ──
        '!**/*.map',
        '!**/*.d.ts',
        '!**/*.md',
        '!**/docs/**',
        '!**/test/**',
        '!**/tests/**',
        '!**/examples/**',
        '!**/.github/**',
    ],

    // Extra files placed OUTSIDE the app.asar (at the root alongside the exe)
    extraResources: [
        {
            from: 'prisma/template.db',
            to: '../prisma/template.db',
        },
        {
            from: 'prisma/schema.sqlite.prisma',
            to: '../prisma/schema.sqlite.prisma',
        },
        {
            from: '.env',
            to: '../.env',
        },
        {
            from: 'public',
            to: '../public',
            filter: ['**/*'],
        },
    ],

    win: {
        target: [
            {
                target: 'nsis',
                arch: ['x64'],
            },
            {
                target: 'portable',
                arch: ['x64'],
            },
        ],
        icon: 'public/logo.png',
        verifyUpdateCodeSignature: false,
    },

    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'Habakkuk Pharmacy POS',
        include: 'build-resources/installer.nsh',
        deleteAppDataOnUninstall: false,
    },

    portable: {
        artifactName: '${productName}-Portable-${version}.${ext}',
    },

    compression: 'normal',

    buildVersion: process.env.BUILD_NUMBER || '1',

    publish: null,
};
