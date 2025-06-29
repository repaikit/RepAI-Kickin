const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing Victory NFT mint function...");

  // Get the contract address from environment or deployment file
  const contractAddress = process.env.AVALANCHE_FUJI_NFT_CONTRACT;
  if (!contractAddress) {
    console.error("❌ Please set AVALANCHE_FUJI_NFT_CONTRACT in your .env file");
    process.exit(1);
  }

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Testing with account:", deployer.address);

  // Get contract instance
  const VictoryNFT = await hre.ethers.getContractFactory("VictoryNFT");
  const victoryNFT = VictoryNFT.attach(contractAddress);

  console.log("📦 Contract address:", victoryNFT.target || victoryNFT.address);

  // Test 1: Check total supply
  console.log("\n📊 Test 1: Checking total supply...");
  const totalSupply = await victoryNFT.totalSupply();
  console.log("✅ Total supply:", totalSupply.toString());

  // Test 2: Mint NFT for 10 wins
  console.log("\n🎯 Test 2: Minting NFT for 10 wins...");
  const testPlayer = deployer.address;
  const testWins = 10;
  const testMetadata = JSON.stringify({
    name: "Victory NFT #1",
    description: "Player achieved 10 victories in Kickin!",
    image: "https://api.kickin.com/nft/victory/10.png",
    attributes: [
      { trait_type: "Total Wins", value: 10 },
      { trait_type: "Milestone", value: 1 },
      { trait_type: "Game", value: "Kickin" },
      { trait_type: "Chain", value: "Avalanche Fuji" },
      { trait_type: "Rarity", value: "Common" }
    ]
  });

  try {
    const mintTx = await victoryNFT.mintVictoryNFT(testPlayer, testWins, testMetadata);
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await mintTx.wait();
    console.log("✅ Mint transaction successful!");
    console.log("📝 Transaction hash:", receipt.hash);
    console.log("⛽ Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.log("❌ Mint failed:", error.message);
  }

  // Test 3: Check player tokens
  console.log("\n🎮 Test 3: Checking player tokens...");
  const playerTokens = await victoryNFT.getPlayerTokens(testPlayer);
  console.log("✅ Player tokens:", playerTokens.map(t => t.toString()));

  // Test 4: Check mint info for latest token
  if (playerTokens.length > 0) {
    console.log("\n📋 Test 4: Checking mint info...");
    const latestTokenId = playerTokens[playerTokens.length - 1];
    const mintInfo = await victoryNFT.getMintInfo(latestTokenId);
    console.log("✅ Mint info for token", latestTokenId.toString());
    console.log("   Player:", mintInfo.player);
    console.log("   Wins:", mintInfo.wins.toString());
    console.log("   Milestone:", mintInfo.milestone.toString());
    console.log("   Minted at:", new Date(Number(mintInfo.mintedAt) * 1000).toISOString());
  }

  // Test 5: Check milestone NFT
  console.log("\n🏆 Test 5: Checking milestone NFT...");
  const hasMilestone = await victoryNFT.hasMilestoneNFT(testPlayer, 1);
  console.log("✅ Has milestone 1 NFT:", hasMilestone);

  // Test 6: Check player milestone count
  console.log("\n📈 Test 6: Checking player milestone count...");
  const milestoneCount = await victoryNFT.getPlayerMilestoneCount(testPlayer);
  console.log("✅ Player milestone count:", milestoneCount.toString());

  // Test 7: Try to mint duplicate milestone (should fail)
  console.log("\n🚫 Test 7: Trying to mint duplicate milestone...");
  try {
    const duplicateTx = await victoryNFT.mintVictoryNFT(testPlayer, 10, testMetadata);
    await duplicateTx.wait();
    console.log("❌ Should have failed but succeeded");
  } catch (error) {
    console.log("✅ Correctly failed:", error.message.includes("already minted") ? "Already minted" : "Other error");
  }

  // Test 8: Mint NFT for 20 wins
  console.log("\n🎯 Test 8: Minting NFT for 20 wins...");
  const testWins20 = 20;
  const testMetadata20 = JSON.stringify({
    name: "Victory NFT #2",
    description: "Player achieved 20 victories in Kickin!",
    image: "https://api.kickin.com/nft/victory/20.png",
    attributes: [
      { trait_type: "Total Wins", value: 20 },
      { trait_type: "Milestone", value: 2 },
      { trait_type: "Game", value: "Kickin" },
      { trait_type: "Chain", value: "Avalanche Fuji" },
      { trait_type: "Rarity", value: "Uncommon" }
    ]
  });

  try {
    const mintTx20 = await victoryNFT.mintVictoryNFT(testPlayer, testWins20, testMetadata20);
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt20 = await mintTx20.wait();
    console.log("✅ Mint transaction successful!");
    console.log("📝 Transaction hash:", receipt20.hash);
  } catch (error) {
    console.log("❌ Mint failed:", error.message);
  }

  // Final summary
  console.log("\n🎉 Test Summary:");
  console.log("================================");
  console.log("Contract:", victoryNFT.target || victoryNFT.address);
  console.log("Player:", testPlayer);
  console.log("Total tokens:", (await victoryNFT.totalSupply()).toString());
  console.log("Player tokens:", (await victoryNFT.getPlayerTokens(testPlayer)).length);
  console.log("Explorer URL:", `https://testnet.snowtrace.io/address/${victoryNFT.target || victoryNFT.address}`);
  console.log("================================");
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }); 