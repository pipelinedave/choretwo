from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import run_migrations
from app.routes.preferences import router as notify_router

app = FastAPI(
    title="Notification Service",
    description="Microservice for push notifications and scheduling",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    user_email = request.headers.get("X-User-Email")

    if not user_email and not request.url.path.startswith("/health"):
        return JSONResponse(
            status_code=401, content={"error": "X-User-Email header required"}
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
