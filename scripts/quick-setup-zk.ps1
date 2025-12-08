# Quick Setup Script for ZK Integration (PowerShell)
# This script sets up the entire ZK proof system

$ErrorActionPreference = "Stop"

Write-Host "🔐 Polverify - ZK Proof System Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if circom is installed
try {
    $circomVersion = circom --version 2>&1
    Write-Host "✅ circom compiler found: $circomVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ circom compiler not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install circom first:"
    Write-Host "  Download from https://github.com/iden3/circom/releases"
    Write-Host "  Add to PATH"
    exit 1
}

Write-Host ""

# Step 1: Install all dependencies
Write-Host "📦 Step 1/5: Installing dependencies..." -ForegroundColor Yellow
npm run install:all
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 2: Compile circuits
Write-Host "🔧 Step 2/5: Compiling ZK circuits..." -ForegroundColor Yellow
Set-Location circuits
npm run compile
Write-Host "✅ Circuits compiled" -ForegroundColor Green
Write-Host ""

# Step 3: Run trusted setup
Write-Host "🔐 Step 3/5: Running trusted setup ceremony..." -ForegroundColor Yellow
npm run setup
Write-Host "✅ Trusted setup complete" -ForegroundColor Green
Write-Host ""

# Step 4: Test circuits
Write-Host "🧪 Step 4/5: Testing circuits..." -ForegroundColor Yellow
npm test
Write-Host "✅ Circuit tests passed" -ForegroundColor Green
Write-Host ""

# Step 5: Compile contracts
Write-Host "📝 Step 5/5: Compiling smart contracts..." -ForegroundColor Yellow
Set-Location ..
npm run compile
Write-Host "✅ Contracts compiled" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:"
Write-Host "1. Deploy contracts:"
Write-Host "   npm run deploy:zk -- --network amoy"
Write-Host ""
Write-Host "2. Update .env with deployed addresses"
Write-Host ""
Write-Host "3. Start backend:"
Write-Host "   npm run backend:dev"
Write-Host ""
Write-Host "4. Start frontend:"
Write-Host "   npm run frontend:dev"
Write-Host ""
Write-Host "⚠️  IMPORTANT:" -ForegroundColor Yellow
Write-Host "- This setup uses a single-party ceremony (for development only)"
Write-Host "- For production, run a multi-party trusted setup ceremony"
Write-Host "- See ZK_INTEGRATION_GUIDE.md for details"
