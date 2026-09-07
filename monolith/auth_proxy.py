"""JWT validation for monolith mode (Option A).

The Go auth-service handles the OAuth2/OIDC callback flow with Dex.
This module handles JWT validation directly in Python, avoiding an HTTP
call to auth-service on every request (hot path optimization).

Both use the same JWT_SECRET so tokens issued by the Go service are
valid here.
"""
import os

import jwt
from fastapi import HTTPException, Request, status

JWT_SECRET = os.getenv("JWT_SECRET", "choretwo-dev-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"

EXEMPT_PATHS = {
    "/health",
    "/",
    "/docs",
    "/docs/",
    "/openapi.json",
    "/redoc",
}


def get_user_email(request: Request) -> str:
    """FastAPI dependency: extract and validate user email from JWT or header.

    Falls back to X-User-Email header for internal service calls and
    dev/test environments where USE_MOCK_AUTH=true.
    """
    use_mock_auth = os.getenv("USE_MOCK_AUTH", "false").lower() == "true"

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            if use_mock_auth:
                # In dev: skip signature validation, just decode
                payload = jwt.decode(token, options={"verify_signature": False})
            else:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            email = payload.get("email")
            if email:
                return email
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {e}",
            )

    # Fallback: X-User-Email header (used by auth-service proxy or dev tools)
    email = request.headers.get("X-User-Email")
    if email:
        return email

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )
