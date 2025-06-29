const { ethers } = require("hardhat");

// CCIP Router và contract info
const BASE_SEPOLIA_ROUTER = "0xD0daae2231E9CB96b94C8512223533293C3693Bf";
const FUJI_CHAIN_SELECTOR = "14767482510784806043";
const FUJI_NFT_CONTRACT = "0x0200B2469eEF9713F7Ae8226D1BDee838B42676e";

async function main() {
  const [signer] = await ethers.getSigners();
  const sender = await signer.getAddress();
  console.log("Sending cross-chain mint from:", sender);

  // Encode data: (address, uint256, string)
  const wins = 10;
  const metadata = JSON.stringify({
    name: "Victory NFT",
    description: "Cross-chain test from Base Sepolia to Fuji",
    image: "https://example.com/nft.png",
    attributes: [
      { trait_type: "Total Wins", value: wins },
      { trait_type: "Milestone", value: 1 },
      { trait_type: "Chain", value: "Avalanche Fuji" },
      { trait_type: "Type", value: "CCIP Cross-Chain" }
    ]
  });
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode([
    "address",
    "uint256",
    "string"
  ], [sender, wins, metadata]);

  // CCIP Router interface
  const router = await ethers.getContractAt(
    [
      "function ccipSend(uint64 destinationChainSelector, (address receiver, bytes data)[] memory receivers, bytes memory data, (address feeToken, uint256 feeAmount) memory extraArgs) external payable returns (bytes32)"
    ],
    BASE_SEPOLIA_ROUTER
  );

  // Gửi message đến contract Fuji
  const destinationChainSelector = FUJI_CHAIN_SELECTOR;
  const receiver = FUJI_NFT_CONTRACT;
  const data = encoded;

  // Chuẩn bị receivers
  const receivers = [
    {
      receiver: receiver,
      data: data
    }
  ];
  const extraArgs = {
    feeToken: ethers.ZeroAddress,
    feeAmount: 0n
  };

  // Gửi với số ETH nhỏ (0.001 ETH = ~$2-3)
  const fee = ethers.parseEther("0.001");
  console.log("Sending CCIP message with fee:", ethers.formatEther(fee), "ETH");

  // Gửi transaction
  const tx = await router.ccipSend(
    destinationChainSelector,
    receivers,
    "0x",
    extraArgs,
    { value: fee }
  );
  console.log("Tx sent:", tx.hash);
  await tx.wait();
  console.log("✅ Cross-chain mint message sent! Check Fuji contract for NFT.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 