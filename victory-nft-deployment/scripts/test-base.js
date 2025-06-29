const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const sender = await signer.getAddress();
  
  console.log("🧪 Testing Base Sepolia Contract");
  console.log("=================================");
  console.log("Deployer:", sender);
  console.log("Network:", hre.network.name);
  
  const BASE_CONTRACT = "0xe0aBf4b49eFBA23C5888cF19E8a8033e03893CEc";
  
  try {
    // Test Base contract
    const baseContract = await ethers.getContractAt("VictoryNFTCCIP", BASE_CONTRACT);
    
    console.log("Testing contract functions...");
    
    const name = await baseContract.name();
    console.log("✅ Name:", name);
    
    const symbol = await baseContract.symbol();
    console.log("✅ Symbol:", symbol);
    
    const router = await baseContract.getRouter();
    console.log("✅ Router:", router);
    
    const totalSupply = await baseContract.totalSupply();
    console.log("✅ Total Supply:", totalSupply.toString());
    
    // Test allowed source chains
    const fujiSelector = "14767482510784806043";
    const isFujiAllowed = await baseContract.isSourceChainAllowed(fujiSelector);
    console.log("✅ Fuji allowed:", isFujiAllowed);
    
    console.log("\n✅ Base Sepolia contract test completed successfully!");
    
  } catch (error) {
    console.error("❌ Base Sepolia contract test failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 