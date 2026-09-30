from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, run_migrations

# REIHENFOLGE IST BEDEUTSAM: rooms VOR chores.
# chores.py deklariert `GET /{chore_id}`. Wuerde der rooms-Router danach
# inkludiert, schluckt diese Route `GET /api/chores/rooms` (chore_id="rooms")
# und liefert 422 statt 200. Siehe routes/rooms.py im Detail.
from app.routes.rooms import router as rooms_router
from app.routes.chores import router as chores_router
from app.routes.export import router as export_router
from app.routes.settings import router as settings_router
from app.middleware.auth import AuthMiddleware

app = FastAPI(
    title="Chore Service",
    description="Microservice for chore management",
    version="1.0.0",
)

app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    run_migrations()


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "chore-service"}


@app.get("/")
async def root():
    return {"message": "Chore Service", "version": "1.0.0"}


app.include_router(rooms_router)  # muss vor chores_router stehen
app.include_router(chores_router)
app.include_router(export_router)
app.include_router(settings_router)
