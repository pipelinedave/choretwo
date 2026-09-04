import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from notify.app.database import run_migrations
from notify.app.routes.preferences import router as notify_router

app = FastAPI(
    title="Notification Service",
    description="Microservice for push notifications and scheduling",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXEMPT_PATHS = ["/health", "/docs", "/docs/", "/openapi.json"]


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path in EXEMPT_PATHS:
        return await call_next(request)

    user_email = None

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


@app.on_event("startup")
async def startup_event():
    run_migrations()


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "notification-service"}


@app.get("/")
async def root():
    return {"message": "Notification Service", "version": "1.0.0"}


app.include_router(notify_router)
