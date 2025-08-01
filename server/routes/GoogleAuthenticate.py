from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from google_oauth import get_google_auth_url, get_tokens, get_user_info
from routes.users import google_login_logic, google_register_logic
from models.user import GoogleAuthRequest
import logging
import os
import traceback

logger = logging.getLogger(__name__)
router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

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
        logger.info(f"Google user_info: {user_info}")
        auth_data = GoogleAuthRequest(
            email=user_info["email"],
            name=user_info["name"],
            picture=user_info.get("picture")
        )
        try:
            login_response = await google_login_logic(auth_data)
            access_token = login_response["access_token"]
            refresh_token = login_response.get("refresh_token", "")
        except HTTPException as e:
            logger.error(f"Google login failed: {str(e)}")
            logger.error(traceback.format_exc())
            if getattr(e, 'status_code', None) == 404:
                try:
                    register_response = await google_register_logic(auth_data)
                    access_token = register_response["access_token"]
                    refresh_token = register_response.get("refresh_token", "")
                except Exception as reg_e:
                    logger.error(f"Google register failed: {str(reg_e)}")
                    logger.error(traceback.format_exc())
                    raise
            else:
                raise
        
        # Tạo redirect URL với cả access token và refresh token
        redirect_url = f"{FRONTEND_URL}/login?token={access_token}"
        if refresh_token:
            redirect_url += f"&refresh_token={refresh_token}"
        
        logger.info(f"Redirecting to: {redirect_url}")
        return RedirectResponse(redirect_url)
    except Exception as e:
        logger.error(f"Unexpected error in auth_google_callback: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during Google authentication"
        )
