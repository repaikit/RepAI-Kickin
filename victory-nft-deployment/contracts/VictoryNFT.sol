// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title VictoryNFT
 * @dev NFT contract for Kickin game victory milestones
 * Minted automatically when players reach 10, 20, 30... wins
 */
contract VictoryNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;

    Counters.Counter private _tokenIds;

    // Mapping from player address to their token IDs
    mapping(address => uint256[]) private _playerTokens;
    
    // Mapping from token ID to metadata
    mapping(uint256 => string) private _tokenMetadata;
    
    // Mapping from token ID to mint info
    mapping(uint256 => MintInfo) private _mintInfo;
    
    // Events
    event VictoryNFTMinted(
        address indexed player,
        uint256 indexed tokenId,
        uint256 wins,
        uint256 milestone,
        string metadata
    );

    struct MintInfo {
        address player;
        uint256 wins;
        uint256 milestone;
        uint256 mintedAt;
    }

    constructor() ERC721("Victory NFT", "VNFT") {
        // Mint token #0 to owner (optional)
        _tokenIds.increment();
        _mint(msg.sender, 0);
    }

    /**
     * @dev Mint Victory NFT for a player
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
        require(player != address(0), "Invalid player address");
        require(wins > 0, "Wins must be greater than 0");
        require(wins % 10 == 0, "Wins must be a multiple of 10");
        
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
            mintedAt: block.timestamp
        });
        
        emit VictoryNFTMinted(player, newTokenId, wins, milestone, metadata);
        
        return newTokenId;
    }

    /**
     * @dev Get token URI (metadata)
     * @param tokenId The token ID
     * @return The metadata URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenMetadata[tokenId];
    }

    /**
     * @dev Get all tokens owned by a player
     * @param player The player's address
     * @return Array of token IDs
     */
    function getPlayerTokens(address player) external view returns (uint256[] memory) {
        return _playerTokens[player];
    }

    /**
     * @dev Get mint info for a token
     * @param tokenId The token ID
     * @return MintInfo struct
     */
    function getMintInfo(uint256 tokenId) external view returns (MintInfo memory) {
        require(_exists(tokenId), "Token does not exist");
        return _mintInfo[tokenId];
    }

    /**
     * @dev Get total supply
     * @return Total number of tokens minted
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIds.current();
    }

    /**
     * @dev Check if player has NFT for specific milestone
     * @param player The player's address
     * @param milestone The milestone number
     * @return True if player has NFT for this milestone
     */
    function hasMilestoneNFT(address player, uint256 milestone) external view returns (bool) {
        uint256[] memory tokens = _playerTokens[player];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (_mintInfo[tokens[i]].milestone == milestone) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Get player's milestone count
     * @param player The player's address
     * @return Number of milestones achieved
     */
    function getPlayerMilestoneCount(address player) external view returns (uint256) {
        return _playerTokens[player].length;
    }

    /**
     * @dev Emergency function to transfer ownership (only owner)
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        super.transferOwnership(newOwner);
    }

    /**
     * @dev Override _beforeTokenTransfer to add custom logic if needed
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        // Add any custom logic here if needed
    }
} 