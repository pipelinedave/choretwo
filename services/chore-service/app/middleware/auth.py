import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user_email = None

        if request.url.path.startswith("/health"):
            request.state.user_email = None
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                payload = jwt.decode(token, options={"verify_signature": False})
                user_email = payload.get("email")
            except Exception:
                pass

        if not user_email:
            user_email = request.headers.get("X-User-Email")

        if not user_email:
            return JSONResponse(
                status_code=401, content={"error": "Authentication required"}
            )

        request.state.user_email = user_email
        response = await call_next(request)
        return response
