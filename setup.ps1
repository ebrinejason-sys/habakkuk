# Habakkuk Pharmacy POS - Quick Setup Script
# Run this file in PowerShell to set up the entire system

Write-Host "🏥 Habakkuk Pharmacy POS System Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install dependencies
Write-Host "📦 Step 1: Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Setup database
Write-Host "🗄️  Step 2: Setting up database..." -ForegroundColor Yellow
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to setup database" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Database setup complete" -ForegroundColor Green
Write-Host ""

# Display success message and credentials
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "Your Pharmacy POS system is ready to use!" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔑 Admin Login Credentials:" -ForegroundColor Yellow
Write-Host "   Email: admin@habakkukpharmacy.com" -ForegroundColor White
Write-Host "   Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "🚀 To start the application, run:" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "📱 Then open your browser to:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "📚 For more information, see README.md or SETUP.md" -ForegroundColor Cyan
Write-Host ""
