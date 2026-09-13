"""Aktionsausführung für das Copilot-Proposal-Pattern.

Führt ein vom User bestätigtes Proposal über die chore-service-Services im
selben Monolith-Prozess aus (In-Process, kein HTTP). Der Monolith bindet die
chore-Pakete als `chore.app.services.chore_service` ein (via sync_vendor).

In der Quelle (services/ai-copilot-service) ist `chore.app` nicht verfügbar
— die Importe sind deshalb Lazy und liefern `None`, wenn das chore-Paket
nicht importierbar ist. Das erlaubt den Standalone-Betrieb der ai-Tests.
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.aihub_client import AIHubError

logger = logging.getLogger(__name__)


def _chore_service():
    """Lazy-Import der chore-service-Funktionen (nur im Monolith verfügbar)."""
    try:
        from chore.app.services import chore_service

        return chore_service
    except ImportError:  # pragma: no cover - nur außerhalb des Monoliths
        logger.warning(
            "chore.app.services.chore_service nicht verfügbar — "
            "Copilot-Execute ist nur im Monolith aktiv."
        )
        return None


def _chore_schemas():
    """Lazy-Import der chore-schemas (ChoreCreate/ChoreUpdate)."""
    try:
        from chore.app import schemas as chore_schemas

        return chore_schemas
    except ImportError:  # pragma: no cover
        return None


def find_chore_by_name(
    db: Session, user_email: str, name: Optional[str]
) -> Optional[int]:
    """Findet eine Chore-ID anhand eines (Teil-)Namens (case-insensitive)."""
    if not name:
        return None
    svc = _chore_service()
    if svc is None:
        raise AIHubError("chore-service nicht im Prozess verfügbar")
    # get_chores liefert Seiten; hier pragmatisch die ersten 100 laden
    chores = svc.get_chores(db, user_email, page=1, limit=100)
    name_l = name.strip().lower()
    for c in chores:
        if c.name and c.name.strip().lower() == name_l:
            return c.id
    # Teilmatch-Fallback
    for c in chores:
        if c.name and name_l in c.name.lower():
            return c.id
    return None


def execute_mark_done(db: Session, chore_id: int, user_email: str) -> dict:
    """Markiert eine Chore als erledigt (via chore-service mark_chore_done)."""
    svc = _chore_service()
    if svc is None:
        return {"success": False, "error": "chore-service nicht verfügbar"}
    chore = svc.mark_chore_done(db, chore_id, user_email)
    if chore is None:
        return {"success": False, "error": f"Chore {chore_id} nicht gefunden"}
    return {"success": True, "data": {"id": chore.id, "done": True, "name": chore.name}}


def execute_create_chore(db: Session, params: dict, user_email: str) -> dict:
    """Legt eine Chore an (via chore-service create_chore)."""
    svc = _chore_service()
    schemas = _chore_schemas()
    if svc is None or schemas is None:
        return {"success": False, "error": "chore-service nicht verfügbar"}

    name = (params.get("name") or "").strip()
    if not name:
        return {"success": False, "error": "kein Chore-Name im Vorschlag"}
    try:
        interval = int(params.get("interval_days") or 7)
    except (TypeError, ValueError):
        interval = 7

    chore_data = schemas.ChoreCreate(
        name=name,
        interval_days=max(interval, 1),
        is_private=False,
    )
    chore = svc.create_chore(db, chore_data, user_email)
    return {"success": True, "data": {"id": chore.id, "name": chore.name}}


def execute_update_chore(
    db: Session, chore_id: int, params: dict, user_email: str
) -> dict:
    """Aktualisiert eine Chore (via chore-service update_chore)."""
    svc = _chore_service()
    schemas = _chore_schemas()
    if svc is None or schemas is None:
        return {"success": False, "error": "chore-service nicht verfügbar"}

    update_kwargs = {}
    if params.get("new_name"):
        update_kwargs["name"] = params["new_name"]
    if params.get("new_interval"):
        try:
            update_kwargs["interval_days"] = int(params["new_interval"])
        except (TypeError, ValueError):
            pass
    if not update_kwargs:
        return {"success": False, "error": "keine Update-Felder im Vorschlag"}

    chore_data = schemas.ChoreUpdate(**update_kwargs)
    chore = svc.update_chore(db, chore_id, chore_data, user_email)
    if chore is None:
        return {"success": False, "error": f"Chore {chore_id} nicht gefunden"}
    return {"success": True, "data": {"id": chore.id, "name": chore.name}}


def execute_archive(db: Session, chore_id: int, user_email: str) -> dict:
    """Archiviert eine Chore (via chore-service archive_chore)."""
    svc = _chore_service()
    if svc is None:
        return {"success": False, "error": "chore-service nicht verfügbar"}
    chore = svc.archive_chore(db, chore_id, user_email)
    if chore is None:
        return {"success": False, "error": f"Chore {chore_id} nicht gefunden"}
    return {
        "success": True,
        "data": {"id": chore.id, "archived": True, "name": chore.name},
    }


def execute_proposal(db: Session, intent: str, params: dict, user_email: str) -> dict:
    """Dispatcher: führt einen bestätigten Intent/Vorschlag aus."""
    if intent == "mark_done":
        chore_id = find_chore_by_name(db, user_email, params.get("chore_name"))
        if chore_id is None:
            return {
                "success": False,
                "error": f"Chore '{params.get('chore_name')}' nicht gefunden",
            }
        return execute_mark_done(db, chore_id, user_email)

    if intent == "create_chore":
        return execute_create_chore(db, params, user_email)

    if intent == "update_chore":
        chore_id = find_chore_by_name(db, user_email, params.get("chore_name"))
        if chore_id is None:
            return {
                "success": False,
                "error": f"Chore '{params.get('chore_name')}' nicht gefunden",
            }
        return execute_update_chore(db, chore_id, params, user_email)

    if intent == "archive":
        chore_id = find_chore_by_name(db, user_email, params.get("chore_name"))
        if chore_id is None:
            return {
                "success": False,
                "error": f"Chore '{params.get('chore_name')}' nicht gefunden",
            }
        return execute_archive(db, chore_id, user_email)

    return {"success": False, "error": f"Unbekannter Intent: {intent}"}
