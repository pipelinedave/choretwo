from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends

from app.database import run_migrations
from app.routes.ai import router as ai_router, ollama_client
from app.middleware.auth import auth_middleware
from app.ollama_client import OllamaClient

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

app.add_middleware(auth_middleware)


@app.on_event("startup")
async def startup_event():
    run_migrations()
    # Initialize Ollama client
    from app.routes.ai import ollama_client

    ollama_client._OllamaClient__client = OllamaClient()


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-copilot-service"}


@app.get("/")
async def root():
    return {"message": "AI Copilot Service", "version": "1.0.0"}


app.include_router(ai_router)
