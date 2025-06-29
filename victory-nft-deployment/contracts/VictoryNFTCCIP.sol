// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import only the interfaces we need from CCIP, not the full contracts
import "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

// Use standard OpenZeppelin contracts
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title VictoryNFTCCIP
 * @dev CCIP-enabled NFT contract for Kickin game victory milestones
 * Can receive cross-chain messages and mint NFTs automatically
 * 
 * This contract implements Chainlink CCIP best practices:
 * - Source chain validation
 * - Duplicate message protection
 * - Proper error handling
 * - Gas limit management
 * - Event emission for monitoring
 */
contract VictoryNFTCCIP is ERC721, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;

    Counters.Counter private _tokenIds;

    // CCIP Router interface
    IRouterClient private immutable i_router;

    // Mapping from player address to their token IDs
    mapping(address => uint256[]) private _playerTokens;
    
    // Mapping from token ID to metadata
    mapping(uint256 => string) private _tokenMetadata;
    
    // Mapping from token ID to mint info
    mapping(uint256 => MintInfo) private _mintInfo;
    
    // Mapping to track processed CCIP messages
    mapping(bytes32 => bool) private _processedMessages;
    
    // Allowed source chains (for security)
    mapping(uint64 => bool) private _allowedSourceChains;
    
    // Gas limit for CCIP operations
    uint256 private constant CCIP_GAS_LIMIT = 200_000;
    
    // Events
    event VictoryNFTMinted(
        address indexed player,
        uint256 indexed tokenId,
        uint256 wins,
        uint256 milestone,
        string metadata,
        bytes32 indexed messageId
    );

    event CCIPMessageReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        bytes sender,
        bytes data
    );

    event SourceChainAdded(uint64 indexed chainSelector);
    event SourceChainRemoved(uint64 indexed chainSelector);

    // Custom errors for better gas efficiency
    error MessageAlreadyProcessed();
    error UnsupportedChain(uint64 chainSelector);
    error InvalidMessageData();
    error MessageProcessingFailed(bytes reason);
    error UnauthorizedSender();
    error InvalidPlayerAddress();
    error InvalidWins();
    error InvalidMetadata();

    struct MintInfo {
        address player;
        uint256 wins;
        uint256 milestone;
        uint256 mintedAt;
        bytes32 messageId;
    }

    constructor(address router) ERC721("Victory NFT CCIP", "VNFT") {
        i_router = IRouterClient(router);
        
        // Mint token #0 to owner (optional)
        _tokenIds.increment();
        _mint(msg.sender, 0);
        
        // Add default allowed source chains
        // Base Sepolia: 103824977864868
        _allowedSourceChains[103824977864868] = true;
        // Add more chains as needed
    }

    /**
     * @dev Mint Victory NFT for a player (local minting)
     * @param player The player's address
     * @param wins Total wins achieved
     * @param metadata JSON metadata for the NFT
     * @return tokenId The minted token ID
     */
    function mintVictoryNFT(
        address player,
        uint256 wins,
        string memory metadata
    ) external onlyOwner returns (uint256) {
        return _mintNFT(player, wins, metadata, bytes32(0));
    }

    /**
     * @dev CCIP Receiver function - called by router when cross-chain message arrives
     * @param message The CCIP message containing mint data
     */
    function ccipReceive(Client.Any2EVMMessage calldata message) external {
        require(msg.sender == address(i_router), "Only router can call");
        bytes32 messageId = message.messageId;
        if (_processedMessages[messageId]) revert MessageAlreadyProcessed();
        _processedMessages[messageId] = true;
        if (!_allowedSourceChains[message.sourceChainSelector]) revert UnsupportedChain(message.sourceChainSelector);
        if (message.data.length == 0) revert InvalidMessageData();
        try this._processCCIPMessage(
            message.messageId,
            message.sourceChainSelector,
            message.sender,
            message.data
        ) {
        } catch (bytes memory reason) {
            _processedMessages[messageId] = false;
            revert MessageProcessingFailed(reason);
        }
    }

    /**
     * @dev Process CCIP message - external function for try-catch
     * @param messageId The CCIP message ID
     * @param sourceChainSelector The source chain selector
     * @param sender The sender address
     * @param data The CCIP message data
     */
    function _processCCIPMessage(
        bytes32 messageId,
        uint64 sourceChainSelector,
        bytes memory sender,
        bytes memory data
    ) external {
        require(msg.sender == address(this), "Only self-call allowed");
        (address player, uint256 wins, string memory metadata) = abi.decode(
            data,
            (address, uint256, string)
        );
        if (player == address(0)) revert InvalidPlayerAddress();
        if (wins == 0) revert InvalidWins();
        if (wins % 10 != 0) revert InvalidWins();
        if (bytes(metadata).length == 0) revert InvalidMetadata();
        uint256 tokenId = _mintNFT(player, wins, metadata, messageId);
        emit CCIPMessageReceived(
            messageId,
            sourceChainSelector,
            sender,
            data
        );
        emit VictoryNFTMinted(player, tokenId, wins, wins / 10, metadata, messageId);
    }

    /**
     * @dev Internal function to mint NFT
     * @param player The player's address
     * @param wins Total wins achieved
     * @param metadata JSON metadata for the NFT
     * @param messageId The CCIP message ID (0 for local minting)
     * @return tokenId The minted token ID
     */
    function _mintNFT(
        address player,
        uint256 wins,
        string memory metadata,
        bytes32 messageId
    ) internal returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        uint256 milestone = wins / 10;
        
        _mint(player, newTokenId);
        _playerTokens[player].push(newTokenId);
        _tokenMetadata[newTokenId] = metadata;
        _mintInfo[newTokenId] = MintInfo({
            player: player,
            wins: wins,
            milestone: milestone,
            mintedAt: block.timestamp,
            messageId: messageId
        });
        
        return newTokenId;
    }

    /**
     * @dev Get all token IDs owned by a player
     * @param player The player's address
     * @return Array of token IDs
     */
    function getPlayerTokens(address player) external view returns (uint256[] memory) {
        return _playerTokens[player];
    }

    /**
     * @dev Get metadata for a specific token
     * @param tokenId The token ID
     * @return The metadata string
     */
    function getTokenMetadata(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenMetadata[tokenId];
    }

    /**
     * @dev Get mint info for a specific token
     * @param tokenId The token ID
     * @return The mint info struct
     */
    function getMintInfo(uint256 tokenId) external view returns (MintInfo memory) {
        require(_exists(tokenId), "Token does not exist");
        return _mintInfo[tokenId];
    }

    /**
     * @dev Check if a message has been processed
     * @param messageId The CCIP message ID
     * @return True if processed, false otherwise
     */
    function isMessageProcessed(bytes32 messageId) external view returns (bool) {
        return _processedMessages[messageId];
    }

    /**
     * @dev Check if a source chain is allowed
     * @param chainSelector The chain selector
     * @return True if allowed, false otherwise
     */
    function isSourceChainAllowed(uint64 chainSelector) external view returns (bool) {
        return _allowedSourceChains[chainSelector];
    }

    /**
     * @dev Add an allowed source chain (owner only)
     * @param chainSelector The chain selector to add
     */
    function addAllowedSourceChain(uint64 chainSelector) external onlyOwner {
        _allowedSourceChains[chainSelector] = true;
        emit SourceChainAdded(chainSelector);
    }

    /**
     * @dev Remove an allowed source chain (owner only)
     * @param chainSelector The chain selector to remove
     */
    function removeAllowedSourceChain(uint64 chainSelector) external onlyOwner {
        _allowedSourceChains[chainSelector] = false;
        emit SourceChainRemoved(chainSelector);
    }

    /**
     * @dev Get the CCIP router address
     * @return The router address
     */
    function getRouter() external view returns (address) {
        return address(i_router);
    }

    /**
     * @dev Override tokenURI to return metadata
     * @param tokenId The token ID
     * @return The token URI
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return _tokenMetadata[tokenId];
    }

    /**
     * @dev Get total supply
     * @return Total number of tokens minted
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIds.current();
    }

    /**
     * @dev Emergency function to clear processed message (owner only)
     * Use this if a message processing failed and needs to be retried
     * @param messageId The message ID to clear
     */
    function clearProcessedMessage(bytes32 messageId) external onlyOwner {
        _processedMessages[messageId] = false;
    }

    /**
     * @dev Withdraw any stuck tokens (owner only)
     * @param token The token address to withdraw
     * @param to The address to send tokens to
     * @param amount The amount to withdraw
     */
    function withdrawTokens(address token, address to, uint256 amount) external onlyOwner {
        // This would need to be implemented based on the token type
        // For ERC20: IERC20(token).transfer(to, amount);
        // For ETH: payable(to).transfer(amount);
    }

    /**
     * @dev Allow the contract to receive ETH (for CCIP fees)
     */
    receive() external payable {}

    /**
     * @dev Emergency function to withdraw ETH (only owner)
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "ETH withdrawal failed");
    }
} 