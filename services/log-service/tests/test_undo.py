import pytest
from unittest.mock import Mock, patch
from app.services.undo_service import undo_action


class TestUndoService:
    def test_undo_not_found(self):
        mock_db = Mock()
        mock_db.execute.return_value.fetchone.return_value = None

        with pytest.raises(ValueError, match="Log entry not found"):
            undo_action(999, "test@example.com", mock_db)

    def test_undo_created_action(self):
        mock_db = Mock()
        mock_db.execute.return_value.fetchone.return_value = (
            "created",
            {"id": 123},
            123,
        )

        with patch("app.services.undo_service.httpx.AsyncClient"):
            result = undo_action(1, "test@example.com", mock_db)

            assert result["undone_action_type"] == "created"
            assert result["log_id"] == 1

    def test_undo_updated_action(self):
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

        with patch("app.services.undo_service.httpx.AsyncClient"):
            result = undo_action(2, "test@example.com", mock_db)

            assert result["undone_action_type"] == "updated"

    def test_undo_marked_done_action(self):
        mock_db = Mock()
        mock_db.execute.return_value.fetchone.return_value = (
            "marked_done",
            {"chore_id": 789, "previous_due_date": "2024-01-01"},
            789,
        )

        with patch("app.services.undo_service.httpx.AsyncClient"):
            result = undo_action(3, "test@example.com", mock_db)

            assert result["undone_action_type"] == "marked_done"
