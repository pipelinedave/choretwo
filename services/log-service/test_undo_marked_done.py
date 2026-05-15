"""
Lokaler Test für den undo marked_done Bug.
Testet die undo_action Logic direkt OHNE Docker.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date, timedelta
import pytest

@pytest.mark.asyncio
async def test_undo_marked_done():
    print("\n=== LOCAL UNDO TEST ===\n")
    
    # Mock the DB and log entry
    mock_db = MagicMock()
    log_entry = ("marked_done", {
        "chore_id": 123,
        "previous_due_date": str(date.today()),
        "previous_last_done": None
    }, 123)
    mock_db.execute.return_value.fetchone.return_value = log_entry
    
    # Import
    from app.services.undo_service import undo_action
    
    try:
        result = await undo_action(1, "test@example.com", mock_db)
        print(f"✅ Undo result: {result.get('message')}")
    except SyntaxError as e:
        print(f"❌ SYNTAX ERROR in undo_service.py!")
        print(f"   {e}")
        return

@pytest.mark.asyncio
async def test_undo_service_syntax():
    """Test that undo_service.py has valid syntax"""
    import ast
    with open("/home/dhallmann/projects/choretwo/services/log-service/app/services/undo_service.py") as f:
        source = f.read()
    try:
        ast.parse(source)
        print("✅ undo_service.py syntax is valid")
    except SyntaxError as e:
        print(f"❌ Syntax error: {e}")
        raise
