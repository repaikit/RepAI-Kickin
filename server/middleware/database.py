from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import sys
from pathlib import Path

# Add the parent directory to Python path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from database.database import Database

class DatabaseMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            # Create new database instance for each request
            db = await Database.get_instance()
            request.state.db = await db.get_database()
            response = await call_next(request)
            return response
        except Exception as e:
            # Log error and re-raise
            raise e
        finally:
            # Clean up database connection
            if hasattr(request.state, 'db'):
                await db.close()

# Create middleware factory function
def database_middleware(app):
    return DatabaseMiddleware(app) 