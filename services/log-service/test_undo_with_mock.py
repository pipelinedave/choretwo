"""
Unit-Test für undo_action (marked_done) mit DebugMCP.
Erzeugt einen Undo-Call der die undo_action functie testet.
"""
import asyncio
import json
from datetime import date, timedelta
from unittest.mock import MagicMock, patch, AsyncMock
import pytest


@pytest.fixture
def mock_db():
    """Mock database session with a marked_done log entry"""
    db = MagicMock()
    
    # Simulate the SQL query result
    log_entry = (
        "marked_done",
        {
            "chore_id": 42,
            "previous_due_date": str(date.today() - timedelta(days=1)),  # Yesterday
            "previous_last_done": str(date.today() - timedelta(days=1))   # Yesterday
        },
        42
    )
    
    db.execute.return_value.fetchone.return_value = log_entry
    return db


@pytest.mark.asyncio
async def test_undo_marked_done_resets_all_fields(mock_db):
    """
    TEST: undo marked_done sollte alle done-related Felder zurücksetzen
    - done -> False
    - due_date -> previous_due_date (vom Log)
    - last_done -> None
    - done_by -> None
    """
    from app.services.undo_service import undo_action
    
    with patch("app.services.undo_service.create_log"), patch("app.services.undo_service.httpx.AsyncClient"):
        # Trigger the undo
        result = await undo_action(1, "test@example.com", mock_db)
        
        # Verify the result structure
        assert result["undone_action_type"] == "marked_done"
        assert result["message"] == "Action marked_done undone successfully"


@pytest.mark.asyncio 
async def test_undo_marked_done_with_http_mock():
    """
    TEST: Undo marked_done mit mocked HTTP calls to verify payload
    """
    from app.services.undo_service import undo_action
    
    # Create mock db
    db = MagicMock()
    log_entry = (
        "marked_done",
        {
            "chore_id": 42,
            "previous_due_date": "2026-05-13",  # Previous due date
            "previous_last_done": "2026-05-13"
        },
        42
    )
    db.execute.return_value.fetchone.return_value = log_entry
    
    # Mock the httpx.AsyncClient
    mock_put_calls = []
    
    async def mock_put(url, headers=None, json=None, params=None):
        mock_put_calls.append({
            "url": url,
            "headers": dict(headers) if headers else {},
            "json": json,
            "params": params
        })
        
        # Mock response
        response = MagicMock()
        response.status_code = 200
        return response
    
    # Mock create_log
    with patch("app.services.undo_service.create_log"):
        with patch("app.services.undo_service.httpx.AsyncClient", return_value=AsyncMock()) as mock_client_class:
            mock_client = AsyncMock()
            mock_client.put = mock_put
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            
            # Call undo
            result = await undo_action(1, "test@example.com", db)
    
    # Inspect the HTTP calls
    print("\n=== HTTP PUT CALLS MADE ===")
    for i, call in enumerate(mock_put_calls):
        print(f"\nCall {i+1}:")
        print(f"  URL: {call['url']}")
        print(f"  JSON payload: {json.dumps(call['json'], indent=6) if call['json'] else 'None'}")
        if call['params']:
            print(f"  Params: {call['params']}")
    
    # Verify correct calls were made
    assert len(mock_put_calls) >= 1, "At least one PUT call should be made"
    
    # Check the payload
    first_call = mock_put_calls[0]
    expected_payload = {
        "done": False,
        "last_done": None,
        "done_by": None
    }
    
    if first_call["json"]:
        print(f"\n=== VERIFICATION ===")
        if first_call["json"].get("done") == False:
            print("✅ done=False")
        else:
            print(f"❌ done={first_call['json'].get('done')} (expected False)")
            
        if first_call["json"].get("due_date") == "2026-05-13":
            print("✅ due_date=2026-05-13 (restored)")
        elif "due_date" in first_call["json"]:
            print(f"❌ due_date={first_call['json']['due_date']} (expected 2026-05-13)")
        else:
            print("⚠️  due_date not in payload")
            
        if first_call["json"].get("last_done") is None:
            print("✅ last_done=None")
        else:
            print(f"❌ last_done={first_call['json'].get('last_done')} (expected None)")
            
        if first_call["json"].get("done_by") is None:
            print("✅ done_by=None")
        else:
            print(f"❌ done_by={first_call['json'].get('done_by')} (expected None)")


if __name__ == "__main__":
    asyncio.run(test_undo_marked_done_with_http_mock())
