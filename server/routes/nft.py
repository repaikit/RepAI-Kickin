import os
import time
import logging
import requests
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
MORALIS_API_KEY = os.getenv("MORALIS_API_KEY")

if not MORALIS_API_KEY:
    raise RuntimeError("❌ MORALIS_API_KEY not found in environment variables!")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter()

# --- Models ---
class NFT(BaseModel):
    token_address: Optional[str]
    token_id: Optional[str]
    contract_type: Optional[str]
    name: Optional[str]
    symbol: Optional[str]
    metadata: Optional[str]

class NFTResponse(BaseModel):
    address: str
    total_nfts: int
    nfts: List[NFT]


# --- Fetch function ---
def fetch_nfts(address: str, max_nfts: int = 300) -> dict:
    url = f"https://deep-index.moralis.io/api/v2/{address}/nft?chain=eth&format=decimal&limit=100"
    headers = {"X-API-Key": MORALIS_API_KEY}
    all_nfts = []
    cursor = None
    page = 1

    while True:
        full_url = url + (f"&cursor={cursor}" if cursor else "")
        logger.info(f"🔄 Fetching page {page} for address {address}...")

        response = requests.get(full_url, headers=headers)
        if response.status_code != 200:
            logger.error(f"❌ API Error {response.status_code}: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=response.text)

        data = response.json()
        nfts = data.get("result", [])
        all_nfts.extend(nfts)

        if len(all_nfts) >= max_nfts:
            all_nfts = all_nfts[:max_nfts]
            break

        if data.get("cursor"):
            cursor = data["cursor"]
            page += 1
            time.sleep(0.2)  # avoid rate limit
        else:
            break

    return {
        "address": address,
        "total_nfts": len(all_nfts),
        "nfts": all_nfts
    }


# --- API Endpoint ---
@router.get("/nfts", response_model=NFTResponse, summary="Get NFTs by wallet address")
async def get_nfts(
    address: str = Query(..., description="Wallet address to fetch NFTs for"),
    max_nfts: int = Query(300, gt=0, le=1000, description="Maximum number of NFTs to fetch (1–1000)")
):
    return fetch_nfts(address, max_nfts)
