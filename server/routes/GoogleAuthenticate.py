from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from google_oauth import get_google_auth_url, get_tokens, get_user_info
from routes.users import register_with_google, login_with_google
from models.user import GoogleAuthRequest
import logging
import os

logger = logging.getLogger(__name__)
router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000/login")

@router.get("/")
def home():
    return {"message": "FastAPI Google Login"}

@router.get("/auth/google")
def login_google():
    try:
        return RedirectResponse(get_google_auth_url())
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Google OAuth configuration is incomplete. Please check environment variables."
        )
    except Exception as e:
        logger.error(f"Unexpected error in login_google: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while initiating Google login"
        )

@router.get("/auth/google/callback")
async def auth_google_callback(request: Request):
    try:
        code = request.query_params.get("code")
        if not code:
            raise HTTPException(
                status_code=400,
                detail="Authorization code is missing"
            )
            
        tokens = await get_tokens(code)
        user_info = await get_user_info(tokens["access_token"])
        
        # Tạo request data cho đăng ký/đăng nhập
        auth_data = GoogleAuthRequest(
            email=user_info["email"],
            name=user_info["name"],
            picture=user_info.get("picture")
        )
        
        try:
            # Thử đăng nhập trước
            login_response = await login_with_google(auth_data)
            token = login_response.access_token if hasattr(login_response, "access_token") else login_response.get("access_token")
        except HTTPException as e:
            if e.status_code == 404:
                # Nếu user chưa tồn tại, đăng ký mới
                register_response = await register_with_google(auth_data)
                token = register_response.access_token if hasattr(register_response, "access_token") else register_response.get("access_token")
            else:
                raise
        # Redirect về frontend kèm token
        redirect_url = f"{FRONTEND_URL}?token={token}"
        return RedirectResponse(redirect_url)
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in auth_google_callback: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during Google authentication"
        )
