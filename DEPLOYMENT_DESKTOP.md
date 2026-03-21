# 🚀 Desktop Deployment Guide — Pre-Populated Database

This guide explains how to build the Habakkuk Pharmacy POS desktop application with a **pre-populated database** for distribution to target PCs.

---

## 📦 How It Works

1. **Sync Phase**: Pull all data from the cloud (`habakkukpharmacy.com`) to local SQLite
2. **Build Phase**: Package Next.js app + the populated database with electron-builder
3. **Distribute**: Users install and immediately have all cloud data ready
4. **Sync After Install**: App continues syncing changes every 30 seconds

---

## ✅ Prerequisites

- Windows PC with Node.js 18+
- Internet connection (for initial sync)
- `.env` file configured with sync credentials:
  ```env
  SYNC_SERVER_URL=https://habakkukpharmacy.com
  SYNC_API_KEY=your-secret-sync-key
  ```

---

## 🏗️ Build Process

### Option 1: Automated Build (Recommended)

```powershell
# Run the build script
node scripts/build-with-data.js
```

This script will:
1. ✅ Check environment variables
2. ✅ Set up SQLite database (if not exists)
3. ✅ Sync data from cloud to local DB
4. ✅ Build Next.js for production
5. ✅ Package with electron-builder
6. ✅ Output: `dist/Habakkuk-Pharmacy-Setup-X.X.X.exe`

### Option 2: Manual Build

If you prefer manual control:

```powershell
# Step 1: Ensure database is ready
npm run db:desktop:setup

# Step 2: Sync cloud data
npx tsx scripts/initial-sync.ts

# Step 3: Build Next.js
$env:NEXT_PUBLIC_IS_DESKTOP="true"
$env:DATABASE_URL="file:./prisma/dev.db"
npm run build

# Step 4: Build installer
npx electron-builder --win --x64 --config electron-builder.config.js
```

---

## 📁 What Gets Packaged

The installer includes:

| Component | Location | Description |
|-----------|----------|-------------|
| **App Code** | `.next/` | Built Next.js application |
| **Database** | `prisma/dev.db` | ⭐ Pre-populated SQLite database |
| **Schema** | `prisma/schema.sqlite.prisma` | Database schema |
| **Prisma** | `node_modules/@prisma/` | Database client |
| **Electron** | `main.js` | Desktop shell |

---

## 🎯 Installing on Target PC

### Method 1: Installer (Recommended)

1. Copy `dist/Habakkuk-Pharmacy-Setup-X.X.X.exe` to target PC
2. Double-click to run installer
3. Follow installation wizard
4. Launch from Desktop or Start Menu
5. **Login with your existing cloud credentials**

### Method 2: Portable Version

If you built the portable target:
- Copy `dist/Habakkuk Pharmacy POS X.X.X.exe` to target PC
- Run directly — no installation needed
- Data is stored alongside the executable

---

## 🔐 Default Login

The database includes your cloud users. Login with:

- **Email**: `admin@habakkukpharmacy.com`
- **Password**: (your existing admin password from cloud)

Or any staff account that exists in your cloud database.

---

## 🔄 How Sync Works After Installation

Once installed, the app:

1. **Starts Local Server**: Next.js runs on `localhost:3001`
2. **Background Sync**: Every 30 seconds, checks for cloud updates
3. **Two-way Sync**: 
   - Local changes → pushed to cloud (when online)
   - Cloud changes → pulled to local
4. **Offline Resilient**: Works without internet, syncs when reconnected

### Sync Queue

Changes made offline are stored in `SyncQueue` table and processed when online:
- `PENDING` → `PROCESSING` → `SYNCED`
- Failed syncs are retried automatically

---

## 🆘 Troubleshooting

### Issue: Installer doesn't include data

**Cause**: Database not synced before build  
**Fix**: Run `npx tsx scripts/initial-sync.ts` before building

### Issue: Target PC shows "First Run Setup Required"

**Cause**: Database not found in packaged app  
**Fix**: Check `electron-builder.config.js` includes `prisma/dev.db` in `extraFiles`

### Issue: Sync not working on target PC

**Cause**: Missing sync environment variables  
**Fix**: Ensure `.env` in packaged app includes:
```env
SYNC_SERVER_URL=https://habakkukpharmacy.com
SYNC_API_KEY=your-secret-key
```

### Issue: Database is locked

**Cause**: Multiple instances running  
**Fix**: Close all instances and restart

---

## 📝 Updating the Distributed App

To release an update with fresh data:

```powershell
# 1. Sync latest data
npx tsx scripts/initial-sync.ts

# 2. Rebuild
node scripts/build-with-data.js

# 3. Distribute new installer
dist/Habakkuk-Pharmacy-Setup-X.X.X.exe
```

Users can:
- **Option A**: Uninstall old version, install new (keeps data via backup)
- **Option B**: Auto-update (if configured)

---

## 🔒 Security Considerations

1. **API Key Protection**: The `SYNC_API_KEY` is embedded in the app. Distribute only to trusted PCs.
2. **Data Encryption**: Consider encrypting `dev.db` for sensitive deployments.
3. **User Credentials**: Passwords are hashed with bcrypt — they travel securely.

---

## 📊 Build Checklist

Before distributing:

- [ ] Ran `npm install` to ensure dependencies are current
- [ ] `.env` has `SYNC_SERVER_URL` and `SYNC_API_KEY`
- [ ] Database synced successfully (check `prisma/dev.db` size)
- [ ] Build completed without errors
- [ ] Tested installer on a clean Windows VM
- [ ] Verified login works with cloud credentials
- [ ] Confirmed sync is working (make test change, verify it appears in cloud)

---

## 🎉 Success!

Your users now have a **fully functional offline pharmacy POS** that:
- ✅ Works immediately after installation (no setup needed)
- ✅ Has all your cloud data pre-loaded
- ✅ Syncs automatically when internet is available
- ✅ Works offline when needed

---

**Need Help?** Contact support or check `README.md` for general app documentation.
