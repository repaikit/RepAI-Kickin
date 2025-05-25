from fastapi import APIRouter, HTTPException, Depends
import requests
from typing import Optional
from pydantic import BaseModel
import os
from database.database import get_users_collection
from fastapi import Request
from utils.logger import api_logger

router = APIRouter()

ALCHEMY_API_KEY = os.getenv("ALCHEMY_API_KEY", "I7wuKmkftvqnxW7DNutlm0DF4v-buuET")

class NFTResponse(BaseModel):
    total_nfts: int
    nfts: list

@router.get("/nfts/{wallet_address}")
async def get_nfts(wallet_address: str, request: Request):
    try:
        api_logger.info(f"Received request for wallet: {wallet_address}")
        api_logger.info(f"Request headers: {request.headers}")
        
        # Get current user from request state
        users_collection = await get_users_collection()
        current_user = request.state.user
        
        api_logger.info(f"Current user: {current_user}")
        
        if not current_user:
            api_logger.error("No user found in request state")
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Verify that the wallet address belongs to the current user
        user_wallet = current_user.get("evm_address")
        api_logger.info(f"User wallet: {user_wallet}, Requested wallet: {wallet_address}")
        
        if user_wallet != wallet_address:
            api_logger.warning(f"Wallet address mismatch. User wallet: {user_wallet}, Requested wallet: {wallet_address}")
            raise HTTPException(status_code=403, detail="Not authorized to view this wallet's NFTs")

        url = f"https://eth-mainnet.g.alchemy.com/nft/v2/{ALCHEMY_API_KEY}/getNFTs"
        params = {
            "owner": wallet_address,
            "withMetadata": "true"
        }
        
        api_logger.info(f"Calling Alchemy API: {url} with params: {params}")
        
        response = requests.get(url, params=params)
        api_logger.info(f"Alchemy API response status: {response.status_code}")
        
        if response.status_code != 200:
            api_logger.error(f"Alchemy API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Alchemy API error: {response.text}")
            
        data = response.json()
        api_logger.info(f"Alchemy API response: {data}")
        
        if not isinstance(data, dict):
            api_logger.error(f"Invalid response type from Alchemy API: {type(data)}")
            raise HTTPException(status_code=400, detail="Invalid response type from Alchemy API")
            
        if "ownedNfts" not in data:
            api_logger.error(f"Invalid response from Alchemy API - no 'ownedNfts' field. Response: {data}")
            raise HTTPException(status_code=400, detail="Invalid response from Alchemy API - no 'ownedNfts' field")
            
        return {
            "total_nfts": data.get("totalCount", 0),
            "nfts": data.get("ownedNfts", [])
        }
    except requests.exceptions.RequestException as e:
        api_logger.error(f"Request error in get_nfts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error calling Alchemy API: {str(e)}")
    except Exception as e:
        api_logger.error(f"Error in get_nfts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) 