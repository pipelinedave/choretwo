"""Pydantic-Schemas fuer chore-service.

Raum-Teil: Die Validierung von `icon` und `color` ist hier Bewusst
STRENG, weil beide Werte im Frontend ungefiltert in eine CSS-Klasse
bzw. einen Inline-Style interpoliert werden. Ein `icon` wie
`"x\" onload=alert(1)"` waere sonst eine Class-Injection. Die
Allowlist unten ist die eine Wahrheit; das Frontend-Picker-Spec
(frontend/src/constants/roomIcons.js) muss sich an ihr orientieren.
"""

import re
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


# ── Raum: erlaubte Icons (MDI-Klassenname ohne "mdi-") ───────────────
ALLOWED_ROOM_ICONS = frozenset(
    {
        # Kueche / Essen
        "silverware-fork-knife",
        "coffee",
        "bottle-tonic-outline",
        # Bad
        "shower",
        "bathtub-outline",
        "toilet",
        # Schlafen / Wohnen
        "bed",
        "bed-double-outline",
        "sofa",
        "bookshelf",
        # Flur / Allgemein
        "stairs",
        "home",
        "door",
        # Haushalt
        "washing-machine",
        "broom",
        "basket-outline",
        "tshirt-crew",
        # Aussen
        "garage",
        "car",
        "flower",
        "carrot",
        # Persoenlich
        "account",
        "arm-flex",
        "dog",
    }
)

ROOM_ICON_PATTERN = re.compile(r"^[a-z0-9-]{1,64}$")
ROOM_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
ROOM_NAME_MAX = 100


def _validate_icon(value: str) -> str:
    v = (value or "").strip()
    if not ROOM_ICON_PATTERN.match(v):
        raise ValueError("icon muss ein einfacher MDI-Klassenname sein (a-z, 0-9, -)")
    if v not in ALLOWED_ROOM_ICONS:
        raise ValueError(
            f"icon '{v}' ist nicht erlaubt. Erlaubt: {', '.join(sorted(ALLOWED_ROOM_ICONS))}"
        )
    return v


def _validate_color(value: str) -> str:
    v = (value or "").strip()
    if not ROOM_COLOR_PATTERN.match(v):
        raise ValueError("color muss ein Hex-Wert sein, z.B. #c6e7dc")
    return v.lower()


def _validate_name(value: str) -> str:
    v = (value or "").strip()
    if not v:
        raise ValueError("name darf nicht leer sein")
    if len(v) > ROOM_NAME_MAX:
        raise ValueError(f"name darf maximal {ROOM_NAME_MAX} Zeichen haben")
    return v


# ── Raeume ───────────────────────────────────────────────────────────


class RoomCreate(BaseModel):
    name: str
    color: str = "#c6e7dc"
    icon: str = "home"
    is_personal: bool = False
    sort_order: int = 0

    @field_validator("name")
    @classmethod
    def _v_name(cls, v):
        return _validate_name(v)

    @field_validator("color")
    @classmethod
    def _v_color(cls, v):
        return _validate_color(v)

    @field_validator("icon")
    @classmethod
    def _v_icon(cls, v):
        return _validate_icon(v)


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_personal: Optional[bool] = None
    sort_order: Optional[int] = None

    # Validators laufen nur, wenn das Feld wirklich gesetzt ist (Pydantic
    # validiert default-Werte nicht) — sonst waere ein PATCH, der nur den
    # Namen aendert, an einem nicht gesetzten `color` gescheitert.
    @field_validator("name")
    @classmethod
    def _v_name(cls, v):
        return _validate_name(v) if v is not None else v

    @field_validator("color")
    @classmethod
    def _v_color(cls, v):
        return _validate_color(v) if v is not None else v

    @field_validator("icon")
    @classmethod
    def _v_icon(cls, v):
        return _validate_icon(v) if v is not None else v


class RoomResponse(BaseModel):
    id: int
    name: str
    color: str
    icon: str
    is_personal: bool
    sort_order: int
    # DateTime, nicht date: die Spalten sind TIMESTAMP. Mit `date` wirft
    # Pydantic v2 `date_from_datetime_inexact`, sobald die Uhr nicht auf
    # 00:00:00 steht — im SQLite-Test (dort ist die Spalte NULL) faellt
    # das nie auf, in der echten DB immer.
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RoomBrief(BaseModel):
    """Der Raum, wie er in einer Chore-Response eingebettet ist.

    Genug fuer den Chip (Icon + Farbe + Name) und die Dave-Sonder-
    behandlung (is_personal) — ohne die vollen Timestamps.
    """

    id: int
    name: str
    color: str
    icon: str
    is_personal: bool

    class Config:
        from_attributes = True


# ── Chores ───────────────────────────────────────────────────────────


class NotificationPreferencesUpdate(BaseModel):
    enabled: Optional[bool] = None
    notify_times: Optional[List[str]] = None
    notify_overdue: Optional[bool] = None
    notify_soon: Optional[bool] = None


class AIUserPreferencesUpdate(BaseModel):
    learning_enabled: Optional[bool] = None
    suggestion_types: Optional[List[str]] = None


class NotificationPreferencesGet(BaseModel):
    enabled: bool
    notify_times: List[str]
    notify_overdue: bool
    notify_soon: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AIUserPreferencesGet(BaseModel):
    learning_enabled: bool
    suggestion_types: List[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AppearanceSettings(BaseModel):
    theme: str = Field(default="system", pattern="^(light|dark|system)$")


class SettingsResponse(BaseModel):
    notifications: NotificationPreferencesGet
    ai: AIUserPreferencesGet
    appearance: AppearanceSettings


class SettingsUpdate(BaseModel):
    notifications: Optional[NotificationPreferencesUpdate] = None
    ai: Optional[AIUserPreferencesUpdate] = None
    appearance: Optional[AppearanceSettings] = None


class ChoreCreate(BaseModel):
    name: str
    interval_days: Optional[int] = Field(
        default=1, ge=1, description="Interval in days"
    )
    due_date: Optional[date] = Field(
        default=None, description="Due date (defaults to today)"
    )
    is_private: bool = False
    # Optional: NULL/fehlend = kein Raum. Bestehende Chores bleiben
    # gueltig, es gibt keine Breaking-Migration.
    room_id: Optional[int] = None


class ChoreUpdate(BaseModel):
    name: Optional[str] = None
    interval_days: Optional[int] = Field(None, ge=1)
    due_date: Optional[date] = None
    done: Optional[bool] = None
    last_done: Optional[date] = None
    done_by: Optional[str] = None
    # `exclude_unset=True` im Service entscheidet die Semantik:
    #   Feld fehlt        -> Raum bleibt unangetastet
    #   {"room_id": null} -> Raum wird bewusst GELOEST
    #   {"room_id": 5}    -> Raum wird gesetzt
    room_id: Optional[int] = None


class ChoreResponse(BaseModel):
    id: int
    name: str
    interval_days: int
    due_date: date
    done: bool
    done_by: Optional[str]
    last_done: Optional[date]
    owner_email: Optional[str]
    is_private: bool
    archived: bool
    # Raum: sowohl die FK als auch der eingebettete Kurzdatensatz. Der
    # Kurzdatensatz erspart dem Frontend einen zweiten Request fuer den
    # Chip (Icon + Farbe) und traegt is_personal fuer die Dave-Sonder-
    # behandlung.
    room_id: Optional[int] = None
    room: Optional[RoomBrief] = None
    # Nur bei /done gesetzt: die durch die Recurrence vorgezogene nächste
    # Fälligkeit (für den "Nächste Fälligkeit"-Toast im Frontend). Optional,
    # damit bestehende Listen-/Read-Responses unverändert bleiben.
    new_due_date: Optional[date] = None

    class Config:
        from_attributes = True


class ChoreStats(BaseModel):
    overdue: int
    due_soon: int
    on_track: int
    total: int


class ImportExportData(BaseModel):
    chores: List[ChoreResponse]
    logs: Optional[List[dict]] = []
