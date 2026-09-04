"""Nativer JWT-Validator für den Choretwo-Monolith.

Ersetzt die frühere `verify_signature=False`-Middleware der Einzelservices
durch eine echte Signatur-Prüfung. Kompatibel zu den JWTs, die vom
Go-auth-service ausgestellt werden (HS256, JWT_SECRET, Issuer
`choretwo-auth-service`, Audience `choretwo`).
"""

import os

import jwt
from starlette.responses import JSONResponse

JWT_SECRET = os.getenv("JWT_SECRET", "choretwo-dev-jwt-secret-change-in-production")
ISSUER = "choretwo-auth-service"
AUDIENCE = "choretwo"

# Pfade, die keine Authentifizierung erfordern.
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


def validate_token(token: str) -> dict:
    """Validiert einen Bearer-Token mit echter Signatur-Prüfung.

    Wirft jwt.PyJWTError bei ungültigem/abgelaufenem Token.
    Gibt bei Erfolg die Claims zurück (enthält `email` und `name`).
    """
    return jwt.decode(
        token,
        JWT_SECRET,
        algorithms=["HS256"],
        issuer=ISSUER,
        audience=AUDIENCE,
    )


async def auth_middleware(request, call_next):
    """FastAPI-HTTP-Middleware: validiert JWT echt und setzt user_email.

    Falls kein Bearer-Token vorhanden ist, wird auf den `X-User-Email`-Header
    zurückgegriffen (Dev/Mock-Modus). Ist ein Bearer-Token vorhanden, muss
    dessen Signatur gültig sein — andernfalls 401.
    """
    path = request.url.path
    if path in EXEMPT_PATHS:
        return await call_next(request)

    user_email = None
    user_name = None

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = validate_token(token)
            user_email = payload.get("email") or request.headers.get("X-User-Email")
            user_name = payload.get("name")
        except jwt.PyJWTError:
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid or expired token."},
            )
    else:
        user_email = request.headers.get("X-User-Email")

    if not user_email:
        return JSONResponse(
            status_code=401,
            content={"error": "Authentication required"},
        )

    request.state.user_email = user_email
    request.state.user_name = user_name
    return await call_next(request)
