import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import run_migrations
from app.routes.ai import router as ai_router, ollama_client, get_ollama_client
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
    try:
        global ollama_client
        ollama_client = get_ollama_client()
    except Exception as e:
        print(f"[WARN] Ollama client init failed: {e} (AI features degraded)")
        ollama_client = None


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-copilot-service"}


@app.get("/")
async def root():
    return {"message": "AI Copilot Service", "version": "1.0.0"}


app.include_router(ai_router)
