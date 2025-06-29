@echo off
echo 🚀 Victory NFT Deployment Setup
echo ================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Check if .env file exists
if not exist .env (
    echo 📝 Creating .env file from template...
    copy env.example .env
    echo ⚠️  Please edit .env file with your private key and configuration
) else (
    echo ✅ .env file already exists
)

REM Compile contracts
echo 🔨 Compiling contracts...
npm run compile

echo.
echo 🎉 Setup complete!
echo ================================
echo Next steps:
echo 1. Edit .env file with your private key
echo 2. Get testnet AVAX from faucet
echo 3. Run: npm run deploy:fuji
echo 4. Test with: npm run test:mint
echo ================================
pause 