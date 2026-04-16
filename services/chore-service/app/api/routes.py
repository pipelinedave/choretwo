"""Chore Service API routes"""

from fastapi import APIRouter

api_router = APIRouter(prefix="/api/chores")


@api_router.get("/")
async def list_chores():
    """List all chores"""
    return {"message": "List chores endpoint - TODO: Implement"}


@api_router.post("/")
async def create_chore():
    """Create a new chore"""
    return {"message": "Create chore endpoint - TODO: Implement"}


@api_router.put("/{chore_id}")
async def update_chore(chore_id: int):
    """Update a chore"""
    return {"message": "Update chore endpoint - TODO: Implement"}


@api_router.put("/{chore_id}/done")
async def mark_done(chore_id: int):
    """Mark chore as done"""
    return {"message": "Mark done endpoint - TODO: Implement"}


@api_router.put("/{chore_id}/archive")
async def archive_chore(chore_id: int):
    """Archive a chore"""
    return {"message": "Archive chore endpoint - TODO: Implement"}
