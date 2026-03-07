# ============================================================
# HABAKKUK PHARMACY — Desktop Setup Script
# Run this ONCE to initialize the local SQLite database
# and pull all existing data from habakkukpharmacy.com
# ============================================================

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Habakkuk Pharmacy — Desktop Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Step 1: Install dependencies
if (-not (Test-Path ".\node_modules")) {
    Write-Host "[1/5] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: npm install failed" -ForegroundColor Red; exit 1 }
    Write-Host "  OK" -ForegroundColor Green
}
else {
    Write-Host "[1/5] Dependencies already installed." -ForegroundColor Gray
}

# Step 2: Activate SQLite schema
Write-Host ""
Write-Host "[2/5] Activating SQLite schema..." -ForegroundColor Yellow
node scripts/use-sqlite-schema.js
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: schema switch failed" -ForegroundColor Red; exit 1 }
Write-Host "  OK" -ForegroundColor Green

# Step 3: Create local SQLite database
Write-Host ""
Write-Host "[3/5] Creating local database tables..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: prisma generate failed" -ForegroundColor Red; exit 1 }
npx prisma db push --accept-data-loss
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: prisma db push failed" -ForegroundColor Red; exit 1 }
Write-Host "  OK: SQLite database created at prisma/dev.db" -ForegroundColor Green

# Step 4: Try to pull all real data from cloud, fall back to sample seed
Write-Host ""
Write-Host "[4/5] Syncing data from habakkukpharmacy.com..." -ForegroundColor Yellow
Write-Host "      (Internet required for this step)" -ForegroundColor Gray
npx tsx scripts/initial-sync.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARN: Initial sync failed (no internet?). Seeding with sample data..." -ForegroundColor Yellow
    npx tsx prisma/seed.desktop.ts
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: seed failed" -ForegroundColor Red; exit 1 }
    Write-Host "  OK: Sample data loaded" -ForegroundColor Gray
}
else {
    Write-Host "  OK: Real data imported from cloud!" -ForegroundColor Green
}

# Step 5: Done
Write-Host ""
Write-Host "[5/5] Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Ready to Launch!" -ForegroundColor Green  
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Start the desktop app:" -ForegroundColor White
Write-Host "  npm run desktop:dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login credentials (from your cloud account):" -ForegroundColor White
Write-Host "  admin@habakkukpharmacy.com" -ForegroundColor Cyan
Write-Host ""
