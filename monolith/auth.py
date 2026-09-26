"""Nativer JWT-Validator für den Choretwo-Monolith.

Ersetzt die frühere `verify_signature=False`-Middleware der Einzelservices
durch eine echte Signatur-Prüfung. Unterstützt zwei Token-Quellen:

- Supabase Auth (Production): asymmetrische ES256-Signatur, verifiziert
  über den öffentlichen JWKS-Endpoint (`JWT_JWKS_URL`). Neue Supabase-
  Projekte signieren standardmäßig NICHT mehr HS256 mit dem Legacy-JWT-
  Secret — daher JWKS statt Secret.
- Go-auth-service / lokale Dev (Legacy): HS256 mit `JWT_SECRET`, Issuer
  `choretwo-auth-service`, Audience `choretwo`. Wird genutzt, wenn kein
  `JWT_JWKS_URL` gesetzt ist oder das JWKS keine passende Key liefert.
"""

import hmac
import os

import jwt
from jwt.exceptions import PyJWKClientError
from starlette.responses import JSONResponse

JWT_SECRET = os.getenv("JWT_SECRET", "choretwo-dev-jwt-secret-change-in-production")
# Issuer/Audience env-flexibel: Go-auth-service (Default) vs. Supabase Auth
# (JWT_ISSUER=https://<ref>.supabase.co/auth/v1, JWT_AUDIENCE=authenticated).
JWT_ISSUER = os.getenv("JWT_ISSUER", "choretwo-auth-service")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "choretwo")
# JWKS-Endpoint für asymmetrische Signaturen (Supabase ES256). Leer =
# reine HS256-Validierung (lokale Dev / Go-auth-service).
JWT_JWKS_URL = os.getenv("JWT_JWKS_URL", "")

_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(JWT_JWKS_URL, cache_keys=True)
    return _jwks_client


# Vercel-Cron: Wenn gesetzt, akzeptiert NUR der Cron-Endpoint
# (/api/notify/run-due) `Authorization: Bearer $CRON_SECRET` statt eines
# User-JWTs. Bewusst pfad-restrictiert, damit der Secret nie als
# General-Passwort durch die Middleware schlüpft.
CRON_SECRET = os.getenv("CRON_SECRET", "")
CRON_PATH = "/api/notify/run-due"

# Dev-/Mock-Modus. Nur wenn das gesetzt ist, darf der `X-User-Email`-Header
# als Identitaet gelten. Vorher war der Header unbedingt gueltig — unter
# Vercel ist der Monolith direkt aus dem Internet erreichbar, damit konnte
# jeder Anfrage eine beliebige Identitaet vorgeben (Vollstaendiger Bypass der
# Mandantentrennung, auch fuer Schreiboperationen).
# Der Header bleibt fuer den lokalen Dev-Betrieb erhalten, damit die
# Playwright-Suite ohne OIDC-Flow testen kann.
USE_MOCK_AUTH = os.getenv("USE_MOCK_AUTH", "false").lower() == "true"

# Pfade, die keine Authentifizierung erfordern (egal ob GET/POST/...).
EXEMPT_PATHS = {
    "/health",
    "/health/",
    "/docs",
    "/docs/",
    "/openapi.json",
    "/redoc",
    "/redoc/",
    "/",
}

# Pfad-Präfixe, deren GET-Fehlen eines authentifizierten Users erlaubt ist.
# Unauthentifizierte GETs liefern dann NUR öffentliche (Shared-)Chores; die
# Service-Schicht filtert private Chores über `owner_email == user_email`,
# sodass bei user_email=None niemals private Daten herausgegeben werden.
# Schreiboperationen (POST/PUT/DELETE) auf dieselben Pfade bleiben auth-pflichtig.
PUBLIC_READ_GET_PREFIXES = (
    "/api/chores",
    "/api/export",
)


def is_public_read_get(request) -> bool:
    """True, wenn ein GET ohne Login auf einem öffentlich-lesbaren Pfad liegt."""
    if request.method != "GET":
        return False
    path = request.url.path
    return any(path == p or path.startswith(p + "/") for p in PUBLIC_READ_GET_PREFIXES)


def validate_token(token: str) -> dict:
    """Validiert einen Bearer-Token mit echter Signatur-Prüfung.

    Mit gesetztem `JWT_JWKS_URL` wird zuerst per JWKS (asymmetrisch,
    z.B. ES256 von Supabase) validiert; schlägt das fehl (Key nicht
    gefunden, Endpunkt nicht erreichbar), fällt die Prüfung auf HS256
    mit `JWT_SECRET` zurück (Legacy-/Dev-Betrieb). Ohne JWKS-URL wird
    ausschließlich HS256 geprüft.

    Wirft jwt.PyJWTError bei ungültigem/abgelaufenem Token.
    Gibt bei Erfolg die Claims zurück (enthält `email` und `name`).
    """
    if JWT_JWKS_URL:
        try:
            signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                issuer=JWT_ISSUER,
                audience=JWT_AUDIENCE,
            )
        except PyJWKClientError:
            pass
    return jwt.decode(
        token,
        JWT_SECRET,
        algorithms=["HS256"],
        issuer=JWT_ISSUER,
        audience=JWT_AUDIENCE,
    )


def _dev_identity(request):
    """`X-User-Email` als Identitaet — NUR im Dev-/Mock-Modus.

    Ausserhalb davon gibt es keine Header-Identitaet: die Identitaet kommt
    dann ausschliesslich aus dem verifizierten JWT. Vorher war der Header
    unbedingt gueltig, was unter Vercel (Monolith direkt aus dem Internet
    erreichbar) jeden Aufrufer in die Rolle jedes beliebigen Nutzers setzen
    liess.
    """
    if not USE_MOCK_AUTH:
        return None
    return request.headers.get("X-User-Email")


async def auth_middleware(request, call_next):
    """FastAPI-HTTP-Middleware: validiert JWT echt und setzt user_email.

    Ohne Bearer-Token gibt es keine Identitaet — auf den öffentlich lesbaren
    GET-Pfaden wird dann mit `user_email=None` gearbeitet (die Service-Schicht
    liefert dort nur geteilte Chores), alles andere antwortet 401.
    Im Dev-/Mock-Modus (`USE_MOCK_AUTH=true`) akzeptiert die Middleware
    ersatzweise den `X-User-Email`-Header, damit die lokale E2E-Suite ohne
    OIDC-Flow testen kann. In Produktion ist dieser Weg zu.
    """
    path = request.url.path
    if path in EXEMPT_PATHS:
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")

    # Vercel-Cron-Bypass: Bearer == CRON_SECRET auf dem Cron-Endpoint
    # (Vercel Cron sendet GET + `Authorization: Bearer $CRON_SECRET`).
    # Muss VOR der JWT-Prüfung stehen, sonst würde der Secret als
    # ungültiges JWT 401en.
    if (
        CRON_SECRET
        and path == CRON_PATH
        and hmac.compare_digest(auth_header, f"Bearer {CRON_SECRET}")
    ):
        request.state.user_email = None
        request.state.user_name = "vercel-cron"
        return await call_next(request)

    user_email = None
    user_name = None

    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = validate_token(token)
            # Der Header-Fallback gilt nur im Dev-/Mock-Modus. Sonst koennte
            # jeder einen gueltigen Token PLUS eine beliebige Identitaet
            # mitschicken und damit die Identitaet des Tokens ueberschreiben.
            user_email = payload.get("email") or _dev_identity(request)
            user_name = payload.get("name")
        except jwt.PyJWTError:
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid or expired token."},
            )
    else:
        user_email = _dev_identity(request)

    if not user_email:
        # Öffentlich lesbare GET-Endpunkte (Shared-Chores/Export) erlauben
        # auch ohne Login — die Service-Schicht liefert dann nur Nicht-Private.
        if is_public_read_get(request):
            user_email = None
        else:
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required"},
            )

    request.state.user_email = user_email
    request.state.user_name = user_name
    return await call_next(request)
