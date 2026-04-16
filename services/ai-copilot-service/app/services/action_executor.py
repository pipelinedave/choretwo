from typing import Optional
import httpx
import logging

logger = logging.getLogger(__name__)

CHORE_SERVICE_URL = "http://chore-service:80/api"


async def execute_mark_done(chore_id: int, user_email: str) -> dict:
    """Execute mark chore done action"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{CHORE_SERVICE_URL}/chores/{chore_id}/done",
                json={"done_by": user_email},
                headers={"X-User-Email": user_email},
                timeout=10.0,
            )
            return {"success": response.status_code == 200, "data": response.json()}
    except Exception as e:
        logger.error(f"Failed to execute mark done: {e}")
        return {"success": False, "error": str(e)}


async def execute_create_chore(chore_data: dict, user_email: str) -> dict:
    """Execute create chore action"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{CHORE_SERVICE_URL}/chores",
                json=chore_data,
                headers={"X-User-Email": user_email},
                timeout=10.0,
            )
            return {"success": response.status_code == 200, "data": response.json()}
    except Exception as e:
        logger.error(f"Failed to execute create chore: {e}")
        return {"success": False, "error": str(e)}


async def execute_update_chore(
    chore_id: int, update_data: dict, user_email: str
) -> dict:
    """Execute update chore action"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{CHORE_SERVICE_URL}/chores/{chore_id}",
                json=update_data,
                headers={"X-User-Email": user_email},
                timeout=10.0,
            )
            return {"success": response.status_code == 200, "data": response.json()}
    except Exception as e:
        logger.error(f"Failed to execute update chore: {e}")
        return {"success": False, "error": str(e)}


async def execute_archive(chore_id: int, user_email: str) -> dict:
    """Execute archive chore action"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{CHORE_SERVICE_URL}/chores/{chore_id}/archive",
                headers={"X-User-Email": user_email},
                timeout=10.0,
            )
            return {"success": response.status_code == 200, "data": response.json()}
    except Exception as e:
        logger.error(f"Failed to execute archive: {e}")
        return {"success": False, "error": str(e)}
