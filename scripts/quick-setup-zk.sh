#!/bin/bash

# Quick Setup Script for ZK Integration
# This script sets up the entire ZK proof system

set -e

echo "🔐 Polverify - ZK Proof System Setup"
echo "===================================="
echo ""

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo "❌ circom compiler not found!"
    echo ""
    echo "Please install circom first:"
    echo "  macOS:   brew install circom"
    echo "  Linux:   curl -L https://github.com/iden3/circom/releases/download/v2.1.6/circom-linux-amd64 -o /usr/local/bin/circom && chmod +x /usr/local/bin/circom"
    echo "  Windows: Download from https://github.com/iden3/circom/releases"
    exit 1
fi

echo "✅ circom compiler found: $(circom --version)"
echo ""

# Step 1: Install all dependencies
echo "📦 Step 1/5: Installing dependencies..."
npm run install:all
echo "✅ Dependencies installed"
echo ""

# Step 2: Compile circuits
echo "🔧 Step 2/5: Compiling ZK circuits..."
cd circuits
npm run compile
echo "✅ Circuits compiled"
echo ""

# Step 3: Run trusted setup
echo "🔐 Step 3/5: Running trusted setup ceremony..."
npm run setup
echo "✅ Trusted setup complete"
echo ""

# Step 4: Test circuits
echo "🧪 Step 4/5: Testing circuits..."
npm test
echo "✅ Circuit tests passed"
echo ""

# Step 5: Compile contracts
echo "📝 Step 5/5: Compiling smart contracts..."
cd ..
npm run compile
echo "✅ Contracts compiled"
echo ""

echo "🎉 Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Deploy contracts:"
echo "   npm run deploy:zk -- --network amoy"
echo ""
echo "2. Update .env with deployed addresses"
echo ""
echo "3. Start backend:"
echo "   npm run backend:dev"
echo ""
echo "4. Start frontend:"
echo "   npm run frontend:dev"
echo ""
echo "⚠️  IMPORTANT:"
echo "- This setup uses a single-party ceremony (for development only)"
echo "- For production, run a multi-party trusted setup ceremony"
echo "- See ZK_INTEGRATION_GUIDE.md for details"
