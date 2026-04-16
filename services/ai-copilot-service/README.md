# AI Copilot Service

Python/FastAPI microservice for AI-powered chore suggestions and natural language processing.

## Features

- Natural language command parsing via Ollama LLM
- Intent extraction (mark_done, create_chore, update_chore, archive)
- AI-powered chore suggestions based on patterns
- Chore completion analysis and insights
- Integration with Ollama (Mistral 7B default)

## Quick Start

### Local Development

```bash
cd services/ai-copilot-service
pip install -r requirements.txt

# Port-forward Ollama from cluster (if needed)
kubectl port-forward ollama-0:11434:11434 -n open-webui

# Start the service
uvicorn app.main:app --reload
```

Visit: http://localhost:8005/api/ai/chat

### With Docker

```bash
docker build -t pipelinedave/ai-copilot-service .
docker run -p 8005:8000 pipelinedave/ai-copilot-service
```

## API Endpoints

### Chat (Natural Language)

**`POST /api/ai/chat`**
```json
Request: { "message": "Mark dishes done" }
Response: {
  "intent": "mark_done",
  "parameters": { "chore_name": "dishes" },
  "confidence": 0.95,
  "requires_confirmation": true,
  "suggested_action": "Mark chore 'dishes' as complete?"
}
```

### Suggestions

**`GET /api/ai/suggestions`**
```json
Response: [
  {
    "chore_name": "dishes",
    "reason": "Typically done at this time",
    "priority": 0.9
  }
]
```

### Analysis

**`POST /api/ai/analyze`**
```json
Request: { "period": "30d" }
Response: {
  "health_score": 85,
  "trends": { "completion_rate": "+10%", "avg_delay": "-2h" },
  "recommendations": ["Consider increasing trash frequency"]
}
```

### Status

**`GET /api/ai/status`**
```json
Response: {
  "status": "healthy",
  "ollama_connected": true,
  "available_models": ["mistral", "llama3"],
  "current_model": "mistral"
}
```

## Environment Variables

```bash
DATABASE_URL=postgres://user:pass@host:5432/choretwo?schema=ai
OLLAMA_URL=http://localhost:11434
CHORE_SERVICE_URL=http://chore-service:80
SERVER_URL=http://localhost:8005
AI_MODEL=mistral
```

## NLP Commands

Supported natural language commands:

- **"Mark [chore] done"** - Mark chore as complete
- **"Add [chore] every [N] days"** - Create new chore
- **"Push [chore] to next week"** - Update due date
- **"Archive [chore]"** - Archive chore

## Testing

```bash
pytest tests/ -v
pytest tests/ --cov=app --cov-report=html
```

## Architecture

```
app/
├── main.py              # FastAPI app
├── database.py          # SQLAlchemy setup (ai schema)
├── ollama_client.py     # Ollama API client
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic models
├── middleware/
│   └── auth.py          # User validation
├── routes/
│   └── ai.py            # All AI endpoints
├── nlp/
│   ├── intent_parser.py # Intent extraction via LLM
│   └── entity_extractor.py # Entity extraction
└── services/
    ├── suggestions.py   # Suggestion engine
    └── action_executor.py # Execute intents
```

## How It Works

1. User types natural language command in frontend
2. Frontend sends to `/api/ai/chat`
3. AI service parses intent using Ollama LLM
4. Returns parsed intent with confidence score
5. Frontend shows confirmation to user
6. User confirms → Frontend calls chore-service directly

## Models

Default model: **Mistral 7B**

Other supported models (if available in Ollama):
- Llama 3 8B
- Mixtral 8x7B
- Phi-3 3.8B

Change via `AI_MODEL` environment variable.
