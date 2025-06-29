const { ethers } = require("hardhat");

// Test configuration
const TEST_CONFIG = {
  // Contract addresses (updated with actual deployed addresses)
  FUJI_CONTRACT: "0x0200B2469eEF9713F7Ae8226D1BDee838B42676e",  // Avalanche Fuji
  BASE_CONTRACT: "0xe0aBf4b49eFBA23C5888cF19E8a8033e03893CEc",  // Base Sepolia
  
  // Router addresses
  FUJI_ROUTER: "0x554472a2720E5E7D5D3C817529aBA05EEd5F82D8",
  BASE_ROUTER: "0xD0daae2231E9CB96b94C8512223533293C3693Bf",
  
  // Chain selectors
  FUJI_SELECTOR: "14767482510784806043",
  BASE_SELECTOR: "103824977864868"
};

async function main() {
  const [signer] = await ethers.getSigners();
  const sender = await signer.getAddress();
  
  console.log("🧪 Testing Cross-Chain NFT Integration");
  console.log("=====================================");
  console.log("Deployer:", sender);
  console.log("Network:", hre.network.name);
  
  // Test 1: Check contract deployment
  console.log("\n1️⃣ Testing Contract Deployment...");
  await testContractDeployment();
  
  // Test 2: Check allowed source chains
  console.log("\n2️⃣ Testing Allowed Source Chains...");
  await testAllowedSourceChains();
  
  // Test 3: Test local minting
  console.log("\n3️⃣ Testing Local Minting...");
  await testLocalMinting();
  
  // Test 4: Test cross-chain message sending
  console.log("\n4️⃣ Testing Cross-Chain Message...");
  await testCrossChainMessage();
  
  console.log("\n✅ All tests completed!");
}

async function testContractDeployment() {
  try {
    // Test Fuji contract
    const fujiContract = await ethers.getContractAt("VictoryNFTCCIP", TEST_CONFIG.FUJI_CONTRACT);
    const fujiName = await fujiContract.name();
    const fujiSymbol = await fujiContract.symbol();
    const fujiRouter = await fujiContract.getRouter();
    
    console.log("✅ Fuji Contract:");
    console.log("   Name:", fujiName);
    console.log("   Symbol:", fujiSymbol);
    console.log("   Router:", fujiRouter);
    
    // Test Base contract
    const baseContract = await ethers.getContractAt("VictoryNFTCCIP", TEST_CONFIG.BASE_CONTRACT);
    const baseName = await baseContract.name();
    const baseSymbol = await baseContract.symbol();
    const baseRouter = await baseContract.getRouter();
    
    console.log("✅ Base Contract:");
    console.log("   Name:", baseName);
    console.log("   Symbol:", baseSymbol);
    console.log("   Router:", baseRouter);
    
  } catch (error) {
    console.error("❌ Contract deployment test failed:", error.message);
  }
}

async function testAllowedSourceChains() {
  try {
    const [signer] = await ethers.getSigners();
    
    // Test Fuji contract
    const fujiContract = await ethers.getContractAt("VictoryNFTCCIP", TEST_CONFIG.FUJI_CONTRACT);
    const fujiBaseAllowed = await fujiContract.isSourceChainAllowed(TEST_CONFIG.BASE_SELECTOR);
    
    console.log("✅ Fuji Contract - Base Sepolia allowed:", fujiBaseAllowed);
    
    // Test Base contract
    const baseContract = await ethers.getContractAt("VictoryNFTCCIP", TEST_CONFIG.BASE_CONTRACT);
    const baseFujiAllowed = await baseContract.isSourceChainAllowed(TEST_CONFIG.FUJI_SELECTOR);
    
    console.log("✅ Base Contract - Fuji allowed:", baseFujiAllowed);
    
  } catch (error) {
    console.error("❌ Allowed source chains test failed:", error.message);
  }
}

async function testLocalMinting() {
  try {
    const [signer] = await ethers.getSigners();
    const fujiContract = await ethers.getContractAt("VictoryNFTCCIP", TEST_CONFIG.FUJI_CONTRACT);
    
    const testPlayer = signer.address;
    const testWins = 10;
    const testMetadata = JSON.stringify({
      name: "Test Victory NFT",
      description: "Local minting test",
      image: "https://example.com/nft.png",
      attributes: [
        { trait_type: "Total Wins", value: testWins },
        { trait_type: "Milestone", value: 1 },
        { trait_type: "Type", value: "Local Test" }
      ]
    });
    
    console.log("Minting test NFT locally...");
    const tx = await fujiContract.mintVictoryNFT(testPlayer, testWins, testMetadata);
    await tx.wait();
    
    const totalSupply = await fujiContract.totalSupply();
    const playerTokens = await fujiContract.getPlayerTokens(testPlayer);
    
    console.log("✅ Local minting successful:");
    console.log("   Total supply:", totalSupply.toString());
    console.log("   Player tokens:", playerTokens.toString());
    
  } catch (error) {
    console.error("❌ Local minting test failed:", error.message);
  }
}

async function testCrossChainMessage() {
  try {
    const [signer] = await ethers.getSigners();
    
    // Test sending from Base to Fuji
    console.log("Testing Base Sepolia → Fuji message...");
    
    const baseRouter = await ethers.getContractAt(
      [
        "function ccipSend(uint64 destinationChainSelector, (address receiver, bytes data)[] memory receivers, bytes memory data, (address feeToken, uint256 feeAmount) memory extraArgs) external payable returns (bytes32)"
      ],
      TEST_CONFIG.BASE_ROUTER
    );
    
    const testPlayer = signer.address;
    const testWins = 20;
    const testMetadata = JSON.stringify({
      name: "Cross-Chain Test NFT",
      description: "Test from Base to Fuji",
      image: "https://example.com/nft.png",
      attributes: [
        { trait_type: "Total Wins", value: testWins },
        { trait_type: "Milestone", value: 2 },
        { trait_type: "Type", value: "Cross-Chain Test" }
      ]
    });
    
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode([
      "address",
      "uint256", 
      "string"
    ], [testPlayer, testWins, testMetadata]);
    
    const receivers = [{
      receiver: TEST_CONFIG.FUJI_CONTRACT,
      data: encoded
    }];
    
    const extraArgs = {
      feeToken: ethers.ZeroAddress,
      feeAmount: 0n
    };
    
    const fee = ethers.parseEther("0.001");
    
    console.log("Sending cross-chain message...");
    const tx = await baseRouter.ccipSend(
      TEST_CONFIG.FUJI_SELECTOR,
      receivers,
      "0x",
      extraArgs,
      { value: fee }
    );
    
    console.log("✅ Cross-chain message sent:", tx.hash);
    
  } catch (error) {
    console.error("❌ Cross-chain message test failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 