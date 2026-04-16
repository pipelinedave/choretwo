"""AI Copilot Service - FastAPI application"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI Copilot Service",
    description="Microservice for AI-powered chore suggestions and NLP",
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
    return {"status": "ok", "service": "ai-copilot-service"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "AI Copilot Service", "version": "1.0.0"}
