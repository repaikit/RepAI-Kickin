const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get CCIP Router address for the current network
  const routerAddress = getRouterAddress();
  console.log("Using CCIP Router address:", routerAddress);

  // Deploy VictoryNFTCCIP contract
  console.log("\nDeploying VictoryNFTCCIP...");
  const VictoryNFTCCIP = await ethers.getContractFactory("VictoryNFTCCIP");
  const victoryNFT = await VictoryNFTCCIP.deploy(routerAddress);
  await victoryNFT.waitForDeployment();
  const victoryNFTAddress = await victoryNFT.getAddress();
  console.log("VictoryNFTCCIP deployed to:", victoryNFTAddress);

  // Add allowed source chains
  console.log("\nConfiguring allowed source chains...");
  
  // Base Sepolia chain selector
  const baseSepoliaSelector = 103824977864868n;
  await victoryNFT.addAllowedSourceChain(baseSepoliaSelector);
  console.log("Added Base Sepolia as allowed source chain");

  // Add more chains as needed
  // For example, if you want to allow messages from Avalanche Fuji to Base Sepolia:
  // const avalancheFujiSelector = 14767482510784806043n;
  // await victoryNFT.addAllowedSourceChain(avalancheFujiSelector);
  // console.log("Added Avalanche Fuji as allowed source chain");

  console.log("\nDeployment completed successfully!");
  console.log("Network:", network.name);
  console.log("VictoryNFTCCIP:", victoryNFTAddress);
  console.log("CCIP Router:", routerAddress);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    deployer: deployer.address,
    victoryNFT: victoryNFTAddress,
    router: routerAddress,
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment info:", JSON.stringify(deploymentInfo, null, 2));
}

function getRouterAddress() {
  const network = hre.network.name;
  
  // CCIP Router addresses for different networks
  const routers = {
    // Testnets
    "fuji": "0x554472a2720E5E7D5D3C817529aBA05EEd5F82D8", // Avalanche Fuji
    "baseSepolia": "0xD0daae2231E9CB96b94C8512223533293C3693Bf", // Base Sepolia
    "sepolia": "0xD0daae2231E9CB96b94C8512223533293C3693Bf", // Ethereum Sepolia
    "mumbai": "0x70499c328e1E2a3c41108bd3730F6670a44595D1", // Polygon Mumbai
    "bscTestnet": "0x9527E2d01A3064ef4b50c1AA0C8e788Ed0F75334", // BSC Testnet
    
    // Mainnets
    "mainnet": "0xE561d5E02207fb5eB32cca20a699E0d8919a1476", // Ethereum Mainnet
    "avalanche": "0x536d7E53D0aDeB1F20E7c81fea45d02eC8dBD2b8", // Avalanche C-Chain
    "base": "0x536d7E53D0aDeB1F20E7c81fea45d02eC8dBD2b8", // Base
    "polygon": "0x536d7E53D0aDeB1F20E7c81fea45d02eC8dBD2b8", // Polygon
    "bsc": "0x536d7E53D0aDeB1F20E7c81fea45d02eC8dBD2b8" // BSC
  };

  const routerAddress = routers[network];
  if (!routerAddress) {
    throw new Error(`No CCIP Router address found for network: ${network}`);
  }

  return routerAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 