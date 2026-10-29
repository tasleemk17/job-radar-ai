import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, ENABLE_SCHEDULER, REFRESH_HOURS, SEED_DEMO
from .db import Base, SessionLocal, engine
from .ingest import scheduled_refresh, seed_demo
from .routers import ai, applications, auth, jobs, profile, stats

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx logs every request URL at INFO, and the Adzuna and Jooble API keys are part of that URL
for noisy in ("httpx", "httpcore"):
    logging.getLogger(noisy).setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    if SEED_DEMO:
        with SessionLocal() as db:
            seed_demo(db)
    scheduler = None
    if ENABLE_SCHEDULER:
        from apscheduler.schedulers.background import BackgroundScheduler

        scheduler = BackgroundScheduler()
        scheduler.add_job(scheduled_refresh, "interval", hours=REFRESH_HOURS, id="refresh-jobs")
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Job Radar", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"],
)

for module in (auth, profile, jobs, applications, ai, stats):
    app.include_router(module.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
