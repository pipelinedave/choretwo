# AI Copilot Service

Python/FastAPI microservice for AI-powered chore suggestions and natural language processing.

## Features

- Natural language command parsing via LLM provider (Synthetic GLM default)
- Intent extraction (mark_done, create_chore, update_chore, archive)
- Deterministic regex fallback when the LLM provider is unavailable
- AI-powered chore suggestions based on patterns
- Chore completion analysis and insights

## Quick Start

### Local Development

```bash
cd services/ai-copilot-service
pip install -r requirements.txt

# Configure the LLM provider (see .env.example in repo root)
export LLM_API_KEY=<your-key>

# Start the service
uvicorn app.main:app --reload
```

Visit: http://localhost:8005/api/ai/chat

### With Docker

```bash
docker build -t pipelinedave/ai-copilot-service .
docker run -p 8005:8000 -e LLM_API_KEY=<your-key> pipelinedave/ai-copilot-service
```

## LLM Provider

The client (`app/llm_client.py`) is provider-agnostic and speaks the
OpenAI-compatible Chat Completions protocol. Default provider:

- **Synthetic** (synthetic.new) — base URL `https://api.synthetic.new/openai/v1`,
  model `hf:zai-org/GLM-5.3-Flash` (reasoning + tool_call, 524k context).
  Alternative GLM models: `hf:zai-org/GLM-5.2`, `hf:zai-org/GLM-4.7-Flash`.

Any OpenAI-compatible endpoint works — point `LLM_BASE_URL` at it.

### Environment Variables

```bash
LLM_BASE_URL=https://api.synthetic.new/openai/v1
LLM_API_KEY=<secret>          # empty = not configured -> deterministic fallback
LLM_MODEL=hf:zai-org/GLM-5.3-Flash
DATABASE_URL=postgres://user:pass@host:5432/choretwo?schema=ai
CHORE_SERVICE_URL=http://chore-service:80
SERVER_URL=http://localhost:8005
```

The base URL must point up to `/v1`; the client appends `/chat/completions`
itself. A legacy full-URL value (old `ADESSO_HUB_URL` style) is normalized
automatically.

### Legacy adesso AI Hub (deprecated)

If ALL `LLM_*` vars are unset but `ADESSO_HUB_URL` / `ADESSO_API_KEY` /
`ADESSO_MODEL` are set, the client falls back to the adesso AI Hub Sovereign
(`deepseek-v4-flash-sovereign`) and logs a deprecation warning. As soon as any
`LLM_*` var is set, the `LLM_*` vars win exclusively.

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
  "llm_connected": true,
  "llm_provider": "api.synthetic.new",
  "available_models": ["hf:zai-org/GLM-5.3-Flash"],
  "current_model": "hf:zai-org/GLM-5.3-Flash"
}
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
├── llm_client.py        # Provider-agnostic OpenAI-compatible LLM client
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic models
├── middleware/
│   └── auth.py          # User validation
├── routes/
│   └── ai.py            # All AI endpoints
├── nlp/
│   ├── intent_parser.py # Intent extraction via LLM + regex fallback
│   └── entity_extractor.py # Entity extraction
└── services/
    ├── suggestions.py   # Suggestion engine
    └── action_executor.py # Execute intents
```

## How It Works

1. User types natural language command in frontend
2. Frontend sends to `/api/ai/chat`
3. AI service parses intent via the configured LLM provider
   (falls back to deterministic regex parsing on error/missing key)
4. Returns parsed intent with confidence score
5. Frontend shows confirmation to user
6. User confirms → Frontend calls chore-service directly
