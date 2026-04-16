from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends

from app.database import init_db, run_migrations
from app.routes.chores import router as chores_router
from app.routes.export import router as export_router
from app.middleware.auth import auth_middleware

app = FastAPI(
    title="Chore Service",
    description="Microservice for chore management",
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
    return {"status": "ok", "service": "chore-service"}


@app.get("/")
async def root():
    return {"message": "Chore Service", "version": "1.0.0"}


app.include_router(chores_router)
app.include_router(export_router)
