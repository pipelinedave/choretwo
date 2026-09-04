"""Notification Service API routes"""

from fastapi import APIRouter

api_router = APIRouter(prefix="/api/notify")


@api_router.get("/preferences")
async def get_preferences():
    """Get user notification preferences"""
    return {"message": "Get preferences endpoint - TODO: Implement"}


@api_router.put("/preferences")
async def update_preferences():
    """Update user notification preferences"""
    return {"message": "Update preferences endpoint - TODO: Implement"}


@api_router.post("/test")
async def send_test_notification():
    """Send test notification"""
    return {"message": "Send test notification endpoint - TODO: Implement"}


@api_router.get("/scheduled")
async def list_scheduled():
    """List scheduled notifications"""
    return {"message": "List scheduled endpoint - TODO: Implement"}
