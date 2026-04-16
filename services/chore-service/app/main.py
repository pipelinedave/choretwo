"""Chore Service - FastAPI application"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "chore-service"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Chore Service", "version": "1.0.0"}
