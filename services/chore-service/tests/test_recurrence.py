import pytest
from datetime import date, timedelta
from app.services.recurrence import calculate_next_due_date, calculate_chore_score


class TestRecurrence:
    def test_calculate_next_due_date_daily(self):
        from app.models import Chore

        chore = Chore(name="Test", interval_days=1, due_date=date(2024, 1, 1))
        result = calculate_next_due_date(chore, date(2024, 1, 1))
        assert result == date(2024, 1, 2)

    def test_calculate_next_due_date_weekly(self):
        from app.models import Chore

        chore = Chore(name="Test", interval_days=7, due_date=date(2024, 1, 1))
        result = calculate_next_due_date(chore, date(2024, 1, 1))
        assert result == date(2024, 1, 8)

    def test_calculate_chore_score_fresh(self):
        score = calculate_chore_score(date.today() + timedelta(days=3), 7)
        assert score == 100.0

    def test_calculate_chore_score_overdue(self):
        score = calculate_chore_score(date.today() - timedelta(days=7), 7)
        assert score == 0.0

    def test_calculate_chore_score_on_track(self):
        score = calculate_chore_score(date.today() + timedelta(days=3), 7)
        assert score == 100.0
