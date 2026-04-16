import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.services.notifier import send_gotify_notification, send_test_notification


class TestNotifier:
    @pytest.mark.asyncio
    async def test_send_gotify_notification_success(self):
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_client.return_value.__aenter__.return_value.post.return_value = (
                mock_response
            )

            result = await send_gotify_notification("test@example.com", "Test message")

            assert result is True

    @pytest.mark.asyncio
    async def test_send_gotify_notification_failure(self):
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 401
            mock_response.text = "Unauthorized"
            mock_client.return_value.__aenter__.return_value.post.return_value = (
                mock_response
            )

            result = await send_gotify_notification("test@example.com", "Test message")

            assert result is False

    @pytest.mark.asyncio
    async def test_send_gotify_notification_no_token(self):
        with patch("app.services.notifier.GOTIFY_TOKEN", ""):
            result = await send_gotify_notification("test@example.com", "Test message")

            assert result is False
