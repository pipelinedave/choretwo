from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import run_migrations
from app.routes.logs import router as logs_router
from app.middleware.auth import AuthMiddleware

app = FastAPI(
    title="Log Service",
    description="Microservice for audit trail and undo functionality",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthMiddleware)


@app.on_event("startup")
async def startup_event():
    run_migrations()


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "log-service"}


@app.get("/")
async def root():
    return {"message": "Log Service", "version": "1.0.0"}


app.include_router(logs_router)
