import pytest
from unittest.mock import Mock, patch
from app.services.undo_service import undo_action


def _update_calls(mock_db):
    return [
        (str(call.args[0]), call.args[1])
        for call in mock_db.execute.call_args_list
        if "UPDATE" in str(call.args[0])
    ]


class TestUndoService:
    @pytest.mark.asyncio
    async def test_undo_not_found(self):
        mock_db = Mock()
        mock_db.execute.return_value.fetchone.return_value = None

        with pytest.raises(ValueError, match="Log entry not found"):
            await undo_action(999, "test@example.com", mock_db)

    @pytest.mark.asyncio
    async def test_undo_created_action(self):
        mock_db = Mock()
        mock_db.execute.return_value.fetchone.return_value = (
            "created",
            {"id": 123},
            123,
        )

        with patch("app.services.undo_service.create_log") as mock_create_log:
            result = await undo_action(1, "test@example.com", mock_db)

        updates = _update_calls(mock_db)
        assert len(updates) == 1
        sql, params = updates[0]
        assert "archived = TRUE" in sql
        assert params == {"cid": 123, "owner": "test@example.com"}
        mock_db.commit.assert_called()
        mock_create_log.assert_called_once()
        assert mock_create_log.call_args.args[3] == "undo"
        assert result["undone_action_type"] == "created"
        assert result["log_id"] == 1

    @pytest.mark.asyncio
    async def test_undo_updated_action(self):
        mock_db = Mock()
        mock_db.execute.return_value.fetchone.return_value = (
            "updated",
            {
                "previous_state": {
                    "id": 456,
                    "name": "Old Name",
                    "interval_days": 7,
                    "due_date": "2024-01-01",
                }
            },
            456,
        )

        with patch("app.services.undo_service.create_log"):
            result = await undo_action(2, "test@example.com", mock_db)

        updates = _update_calls(mock_db)
        assert len(updates) == 1
        sql, params = updates[0]
        assert "due_date = :due" in sql
        assert params == {
            "name": "Old Name",
            "iv": 7,
            "due": "2024-01-01",
            "cid": 456,
            "owner": "test@example.com",
        }
        mock_db.commit.assert_called()
        assert result["undone_action_type"] == "updated"

    @pytest.mark.asyncio
    async def test_undo_marked_done_action(self):
        mock_db = Mock()
        mock_db.execute.return_value.fetchone.return_value = (
            "marked_done",
            {"chore_id": 789, "previous_due_date": "2024-01-01"},
            789,
        )

        with patch("app.services.undo_service.create_log"):
            result = await undo_action(3, "test@example.com", mock_db)

        updates = _update_calls(mock_db)
        assert len(updates) == 1
        sql, params = updates[0]
        assert "due_date = :due" in sql
        assert params == {"due": "2024-01-01", "cid": 789, "owner": "test@example.com"}
        mock_db.commit.assert_called()
        assert result["undone_action_type"] == "marked_done"

    @pytest.mark.asyncio
    async def test_undo_marked_done_without_previous_due_date(self):
        mock_db = Mock()
        mock_db.execute.return_value.fetchone.return_value = (
            "marked_done",
            {"chore_id": 789},
            789,
        )

        with patch("app.services.undo_service.create_log"):
            result = await undo_action(4, "test@example.com", mock_db)

        updates = _update_calls(mock_db)
        assert len(updates) == 1
        sql, params = updates[0]
        assert "due_date" not in sql
        assert params == {"cid": 789, "owner": "test@example.com"}
        mock_db.commit.assert_called()
        assert result["undone_action_type"] == "marked_done"
