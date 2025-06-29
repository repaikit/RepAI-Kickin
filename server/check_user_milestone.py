#!/usr/bin/env python3
"""
Check user milestone and eligibility for Victory NFT minting
"""

import asyncio
from database.database import get_database

async def check_user_milestone():
    """Check user milestone and eligibility"""
    
    print("🎯 Checking User Milestone and Eligibility...")
    print("=" * 50)
    
    # User IDs from logs
    user_ids = [
        "6833718dcca7e5cb2c2e75b1",  # Super Idol - 160 wins
        "6831c304e6e6fb1b725091bc"   # Anh Nguyễn - 60 wins
    ]
    
    try:
        db = await get_database()
        
        for user_id in user_ids:
            print(f"\n👤 User ID: {user_id}")
            
            # Get user data
            user = await db.users.find_one({"_id": user_id})
            if not user:
                print("   ❌ User not found")
                continue
            
            # Calculate total wins
            kicked_wins = user.get("kicked_win", 0)
            keep_wins = user.get("keep_win", 0)
            total_wins = kicked_wins + keep_wins
            
            print(f"   Name: {user.get('name', 'Unknown')}")
            print(f"   Kicked Wins: {kicked_wins}")
            print(f"   Keep Wins: {keep_wins}")
            print(f"   Total Wins: {total_wins}")
            
            # Check milestone eligibility
            milestone = total_wins // 10
            next_milestone = ((total_wins // 10) + 1) * 10
            wins_to_next = next_milestone - total_wins
            is_exact_milestone = total_wins % 10 == 0
            
            print(f"   Current Milestone: {milestone}")
            print(f"   Next Milestone: {next_milestone}")
            print(f"   Wins to Next: {wins_to_next}")
            print(f"   Is Exact Milestone: {is_exact_milestone}")
            
            # Get Victory NFTs
            wallet_address = user.get("wallet") or user.get("evm_address")
            if wallet_address:
                victory_nfts = await db.victory_nfts.find(
                    {"player_address": wallet_address}
                ).sort("minted_at", -1).to_list(length=20)
                
                print(f"   Wallet: {wallet_address}")
                print(f"   Victory NFTs: {len(victory_nfts)}")
                
                # Check if already minted for current milestone
                if is_exact_milestone and total_wins > 0:
                    has_minted_for_current = any(nft["milestone"] == milestone for nft in victory_nfts)
                    print(f"   Has Minted for Current Milestone: {has_minted_for_current}")
                    
                    # Eligibility
                    eligible = total_wins > 0 and is_exact_milestone and not has_minted_for_current
                    print(f"   Eligible for Mint: {eligible}")
                    
                    if eligible:
                        print(f"   🎉 READY TO MINT! Milestone {milestone}")
                    else:
                        if not is_exact_milestone:
                            print(f"   ❌ Need {wins_to_next} more wins to reach milestone")
                        elif has_minted_for_current:
                            print(f"   ❌ Already minted NFT for milestone {milestone}")
                else:
                    print(f"   ❌ Not at exact milestone (need {wins_to_next} more wins)")
                
                # Show recent NFTs
                if victory_nfts:
                    print(f"   Recent NFTs:")
                    for nft in victory_nfts[:5]:
                        print(f"     - Milestone {nft['milestone']} ({nft['total_wins']} wins) - {nft['destination_chain']}")
            
            print("-" * 40)
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_user_milestone()) 