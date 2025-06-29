const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  console.log(`Configuring allowed source chains on ${network} with account:`, deployer.address);

  // Chain selectors
  const fujiSelector = 14767482510784806043n; // Avalanche Fuji
  const baseSepoliaSelector = 103824977864868n; // Base Sepolia

  try {
    if (network === "fuji") {
      // Configure Fuji contract to accept messages from Base Sepolia
      console.log("\nConfiguring Avalanche Fuji contract...");
      const fujiContract = "0x0200B2469eEF9713F7Ae8226D1BDee838B42676e";
      const fujiContractInstance = await ethers.getContractAt("VictoryNFTCCIP", fujiContract);
      
      // Check if Base Sepolia is already allowed
      const isBaseAllowed = await fujiContractInstance.isSourceChainAllowed(baseSepoliaSelector);
      if (!isBaseAllowed) {
        const tx = await fujiContractInstance.addAllowedSourceChain(baseSepoliaSelector);
        await tx.wait();
        console.log("✅ Added Base Sepolia as allowed source chain on Avalanche Fuji");
      } else {
        console.log("ℹ️ Base Sepolia already allowed on Avalanche Fuji");
      }

    } else if (network === "baseSepolia") {
      // Configure Base Sepolia contract to accept messages from Fuji
      console.log("\nConfiguring Base Sepolia contract...");
      const baseContract = "0xe0aBf4b49eFBA23C5888cF19E8a8033e03893CEc";
      const baseContractInstance = await ethers.getContractAt("VictoryNFTCCIP", baseContract);
      
      // Check if Fuji is already allowed
      const isFujiAllowed = await baseContractInstance.isSourceChainAllowed(fujiSelector);
      if (!isFujiAllowed) {
        const tx = await baseContractInstance.addAllowedSourceChain(fujiSelector);
        await tx.wait();
        console.log("✅ Added Avalanche Fuji as allowed source chain on Base Sepolia");
      } else {
        console.log("ℹ️ Avalanche Fuji already allowed on Base Sepolia");
      }

    } else {
      console.error("❌ Unsupported network. Please use 'fuji' or 'baseSepolia'");
      process.exit(1);
    }

    console.log(`\n🎉 Chain configuration completed successfully on ${network}!`);

  } catch (error) {
    console.error("❌ Error configuring chains:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 