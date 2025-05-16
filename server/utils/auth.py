from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime
from typing import Optional, Dict
from database import get_database
from bson import ObjectId

# ... existing code ...

async def get_current_user_ws(access_token: Optional[str] = None) -> Optional[Dict]:
    """
    Verify WebSocket access token and return user data
    """
    if not access_token:
        return None

    try:
        # Verify the token
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None

        # Get user from database
        db = get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return None

        return user

    except JWTError:
        return None
    except Exception as e:
        print(f"Error in get_current_user_ws: {str(e)}")
        return None 