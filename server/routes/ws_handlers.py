from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ws_handlers.waiting_room import websocket_endpoint

router = APIRouter()

@router.websocket("/ws/waitingroom")
async def waiting_room_websocket(websocket: WebSocket):
    await websocket_endpoint(websocket)
