const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const sender = await signer.getAddress();
  
  console.log("🧪 Testing Fuji Contract");
  console.log("=======================");
  console.log("Deployer:", sender);
  console.log("Network:", hre.network.name);
  
  const FUJI_CONTRACT = "0x0200B2469eEF9713F7Ae8226D1BDee838B42676e";
  
  try {
    // Test Fuji contract
    const fujiContract = await ethers.getContractAt("VictoryNFTCCIP", FUJI_CONTRACT);
    
    console.log("Testing contract functions...");
    
    const name = await fujiContract.name();
    console.log("✅ Name:", name);
    
    const symbol = await fujiContract.symbol();
    console.log("✅ Symbol:", symbol);
    
    const router = await fujiContract.getRouter();
    console.log("✅ Router:", router);
    
    const totalSupply = await fujiContract.totalSupply();
    console.log("✅ Total Supply:", totalSupply.toString());
    
    // Test allowed source chains
    const baseSepoliaSelector = "103824977864868";
    const isBaseAllowed = await fujiContract.isSourceChainAllowed(baseSepoliaSelector);
    console.log("✅ Base Sepolia allowed:", isBaseAllowed);
    
    console.log("\n✅ Fuji contract test completed successfully!");
    
  } catch (error) {
    console.error("❌ Fuji contract test failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 