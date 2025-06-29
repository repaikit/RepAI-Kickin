#!/usr/bin/env python3
"""
Find users in the database
"""

import asyncio
from database.database import get_database

async def find_users():
    """Find users in the database"""
    
    print("🔍 Finding Users in Database...")
    print("=" * 40)
    
    try:
        db = await get_database()
        
        # Get all users
        users = await db.users.find({}).to_list(length=50)
        
        print(f"📊 Total Users: {len(users)}")
        print()
        
        for i, user in enumerate(users[:10]):  # Show first 10 users
            user_id = str(user["_id"])
            name = user.get("name", "Unknown")
            email = user.get("email", "No email")
            kicked_wins = user.get("kicked_win", 0)
            keep_wins = user.get("keep_win", 0)
            total_wins = kicked_wins + keep_wins
            wallet = user.get("wallet") or user.get("evm_address", "No wallet")
            
            print(f"{i+1}. ID: {user_id}")
            print(f"   Name: {name}")
            print(f"   Email: {email}")
            print(f"   Total Wins: {total_wins} ({kicked_wins} kicked + {keep_wins} keep)")
            print(f"   Wallet: {wallet}")
            print()
        
        # Find users with specific names
        print("🔍 Searching for specific users...")
        print("-" * 30)
        
        # Search for "Super Idol"
        super_idol = await db.users.find_one({"name": {"$regex": "Super Idol", "$options": "i"}})
        if super_idol:
            print(f"✅ Found Super Idol:")
            print(f"   ID: {super_idol['_id']}")
            print(f"   Name: {super_idol.get('name')}")
            print(f"   Total Wins: {super_idol.get('kicked_win', 0) + super_idol.get('keep_win', 0)}")
        else:
            print("❌ Super Idol not found")
        
        # Search for "Anh Nguyễn"
        anh_nguyen = await db.users.find_one({"name": {"$regex": "Anh Nguyễn", "$options": "i"}})
        if anh_nguyen:
            print(f"✅ Found Anh Nguyễn:")
            print(f"   ID: {anh_nguyen['_id']}")
            print(f"   Name: {anh_nguyen.get('name')}")
            print(f"   Total Wins: {anh_nguyen.get('kicked_win', 0) + anh_nguyen.get('keep_win', 0)}")
        else:
            print("❌ Anh Nguyễn not found")
        
        # Find users with Victory NFTs
        print("\n🏆 Users with Victory NFTs:")
        print("-" * 30)
        
        victory_users = await db.victory_nfts.distinct("player_address")
        for wallet in victory_users:
            user = await db.users.find_one({"$or": [{"wallet": wallet}, {"evm_address": wallet}]})
            if user:
                total_wins = user.get("kicked_win", 0) + user.get("keep_win", 0)
                nft_count = await db.victory_nfts.count_documents({"player_address": wallet})
                print(f"   {user.get('name', 'Unknown')}: {total_wins} wins, {nft_count} NFTs")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(find_users()) 