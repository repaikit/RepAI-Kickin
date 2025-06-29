const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting Victory NFT deployment...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", balance.toString());

  // Deploy Victory NFT Contract
  console.log("\n📦 Deploying VictoryNFT contract...");
  const VictoryNFT = await hre.ethers.getContractFactory("VictoryNFT");
  const victoryNFT = await VictoryNFT.deploy();
  // Không dùng await victoryNFT.deployed() nữa
  // Lấy contract address từ victoryNFT.target (Hardhat v2.19+)
  const contractAddress = victoryNFT.target || victoryNFT.address;
  console.log("✅ VictoryNFT deployed to:", contractAddress);

  // Wait for a few block confirmations
  console.log("\n⏳ Waiting for confirmations...");
  // Lấy deployTransaction từ victoryNFT (Hardhat v2.19+)
  const receipt = await victoryNFT.deploymentTransaction().wait(5);

  // Verify contract on explorer (if API key is provided)
  if (hre.network.name === "fuji" && process.env.SNOWTRACE_API_KEY) {
    console.log("\n🔍 Verifying contract on Snowtrace...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Snowtrace");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }

  // Test mint function (optional)
  console.log("\n🧪 Testing mint function...");
  try {
    const testPlayer = deployer.address; // Use deployer as test player
    const testWins = 10;
    const testMetadata = JSON.stringify({
      name: "Test Victory NFT #1",
      description: "Test player achieved 10 victories in Kickin!",
      image: "https://api.kickin.com/nft/victory/10.png",
      attributes: [
        { trait_type: "Total Wins", value: 10 },
        { trait_type: "Milestone", value: 1 },
        { trait_type: "Game", value: "Kickin" },
        { trait_type: "Chain", value: "Avalanche Fuji" }
      ]
    });

    const mintTx = await victoryNFT.mintVictoryNFT(testPlayer, testWins, testMetadata);
    await mintTx.wait();
    console.log("✅ Test mint successful! Token ID: 1");
  } catch (error) {
    console.log("⚠️ Test mint failed (this is normal for test):", error.message);
  }

  // Print deployment summary
  console.log("\n🎉 Deployment Summary:");
  console.log("================================");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("VictoryNFT Contract:", contractAddress);
  console.log("Explorer URL:", getExplorerUrl(contractAddress));
  console.log("================================");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    victoryNFT: contractAddress,
    deployTime: new Date().toISOString(),
    explorerUrl: getExplorerUrl(contractAddress)
  };

  const fs = require('fs');
  fs.writeFileSync(
    `deployment-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to:", `deployment-${hre.network.name}.json`);

  // Print environment variables to add
  console.log("\n🔧 Add these to your .env file:");
  console.log("==================================");
  console.log(`AVALANCHE_FUJI_NFT_CONTRACT=${contractAddress}`);
  console.log("==================================");
}

function getExplorerUrl(contractAddress) {
  if (hre.network.name === "fuji") {
    return `https://testnet.snowtrace.io/address/${contractAddress}`;
  } else if (hre.network.name === "baseSepolia") {
    return `https://sepolia.basescan.org/address/${contractAddress}`;
  }
  return `https://etherscan.io/address/${contractAddress}`;
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 