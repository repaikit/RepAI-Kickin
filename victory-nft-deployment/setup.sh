#!/bin/bash

echo "🚀 Victory NFT Deployment Setup"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your private key and configuration"
else
    echo "✅ .env file already exists"
fi

# Compile contracts
echo "🔨 Compiling contracts..."
npm run compile

echo ""
echo "🎉 Setup complete!"
echo "================================"
echo "Next steps:"
echo "1. Edit .env file with your private key"
echo "2. Get testnet AVAX from faucet"
echo "3. Run: npm run deploy:fuji"
echo "4. Test with: npm run test:mint"
echo "================================" 