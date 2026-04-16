import httpx
import os
import logging

GOTIFY_URL = os.getenv("GATWAY_URL", "https://gotify.stillon.top")
GOTIFY_TOKEN = os.getenv("GATWAY_TOKEN", "")

logger = logging.getLogger(__name__)


async def send_gotify_notification(
    user_email: str, message: str, title: str = "Choretwo", priority: int = 1
) -> bool:
    """Send notification via Gotify API"""
    if not GOTIFY_TOKEN:
        logger.warning("Gotify token not configured, skipping notification")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{GOTIFY_URL}/message",
                json={
                    "title": title,
                    "message": message,
                    "priority": priority,
                    "extras": {
                        "client::notification": {
                            "sound": {"url": "notifications/default"}
                        }
                    },
                },
                headers={
                    "X-Gotify-Key": GOTIFY_TOKEN,
                    "Content-Type": "application/json",
                },
            )

            if response.status_code == 200:
                logger.info(f"Notification sent to {user_email}: {message}")
                return True
            else:
                logger.error(
                    f"Failed to send notification: {response.status_code} - {response.text}"
                )
                return False

    except httpx.RequestError as e:
        logger.error(f"Request error sending notification to {user_email}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending notification to {user_email}: {e}")
        return False


async def send_chore_overdue_notification(user_email: str, chore_name: str) -> bool:
    """Send overdue chore notification"""
    message = f"⏰ Chore '{chore_name}' is overdue!"
    return await send_gotify_notification(
        user_email, message, "Chore Overdue", priority=2
    )


async def send_chore_due_soon_notification(
    user_email: str, chore_name: str, due_date: str
) -> bool:
    """Send due soon chore notification"""
    message = f"📅 Chore '{chore_name}' is due on {due_date}"
    return await send_gotify_notification(
        user_email, message, "Chore Due Soon", priority=1
    )


async def send_test_notification(
    user_email: str, message: str, priority: int = 1
) -> bool:
    """Send test notification"""
    return await send_gotify_notification(
        user_email, message, "Choretwo Test", priority
    )
