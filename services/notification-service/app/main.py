from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends

from app.database import run_migrations
from app.routes.preferences import router as notify_router
from app.middleware.auth import auth_middleware

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

app.add_middleware(auth_middleware)


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
