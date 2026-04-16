from fastapi import Request
from fastapi.responses import JSONResponse


async def auth_middleware(request: Request, call_next):
    user_email = request.headers.get("X-User-Email")

    if not user_email and not request.url.path.startswith("/health"):
        return JSONResponse(
            status_code=401, content={"error": "X-User-Email header required"}
        )

    request.state.user_email = user_email
    response = await call_next(request)
    return response
