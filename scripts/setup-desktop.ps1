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

# Step 2: Ensure correct environment vars
Write-Host ""
Write-Host "[2/5] Checking environment..." -ForegroundColor Yellow
if (-not (Test-Path ".\.env")) {
    Write-Host "Creating .env file for desktop mode..." -ForegroundColor Gray
    "NEXT_PUBLIC_IS_DESKTOP=true" | Out-File -FilePath .\.env -Encoding utf8
    "DATABASE_URL=file:./dev.db" | Out-File -FilePath .\.env -Encoding utf8 -Append
}
Write-Host "  OK" -ForegroundColor Green

# Step 3: Create local SQLite database
Write-Host ""
Write-Host "[3/5] Creating local database tables..." -ForegroundColor Yellow
npx prisma generate --schema=prisma/schema.sqlite.prisma
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: prisma generate failed" -ForegroundColor Red; exit 1 }
npx prisma db push --schema=prisma/schema.sqlite.prisma --accept-data-loss
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: prisma db push failed" -ForegroundColor Red; exit 1 }
Write-Host "  OK: SQLite database created at prisma/dev.db" -ForegroundColor Green

# Step 4: Try to pull all real data from cloud, fall back to sample seed
Write-Host ""
Write-Host "[4/5] Syncing data from habakkukpharmacy.com..." -ForegroundColor Yellow
Write-Host "      (Internet required for this step)" -ForegroundColor Gray
npx tsx scripts/initial-sync.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Initial sync failed!" -ForegroundColor Red
    Write-Host "  Please ensure you have an active internet connection so the desktop app can download your real pharmacy data." -ForegroundColor Yellow
    exit 1
}
else {
    Write-Host "  OK: Real data imported from cloud! The database is now ready." -ForegroundColor Green
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
