import logging
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import config
from .db import SessionLocal
from .demo_jobs import DEMO_JOBS
from .embeddings import embed
from .models import Job, utcnow
from .skills import extract_skills
from .sources import fetch_all

log = logging.getLogger("jobradar.ingest")


def _store(db: Session, items: list[dict]) -> int:
    """Adds jobs that are not stored yet. A job is identified by (source, external_id)."""
    known = {(s, e) for s, e in db.execute(select(Job.source, Job.external_id))}
    added = 0
    for item in items:
        if (item["source"], item["external_id"]) in known:
            continue
        text = f'{item["title"]}. {" ".join(item["tags"])}. {item["description"]}'
        db.add(Job(**item, skills=extract_skills(text), embedding=embed(text)))
        known.add((item["source"], item["external_id"]))
        added += 1
    db.commit()
    return added


def seed_demo(db: Session) -> int:
    if db.scalar(select(func.count()).select_from(Job)):
        return 0
    return _store(db, DEMO_JOBS)


def refresh_jobs(db: Session, queries: list[str] | None = None, location: str | None = None) -> dict:
    items, errors, skipped = fetch_all(queries, location)
    added = _store(db, items)
    log.info("refresh: fetched %s, added %s, errors %s, skipped %s", len(items), added, errors, skipped)
    return {"fetched": len(items), "added": added, "errors": errors, "skipped": skipped}


def scheduled_refresh() -> None:
    with SessionLocal() as db:
        refresh_jobs(db)


def needs_refresh(db: Session, now: datetime | None = None) -> bool:
    """True when no real job has been fetched yet, or the newest one is older than REFRESH_HOURS."""
    newest = db.scalar(select(func.max(Job.created_at)).where(Job.source.not_in(("demo", "manual"))))
    return newest is None or (now or utcnow()) - newest > timedelta(hours=config.REFRESH_HOURS)


def refresh_if_stale() -> None:
    """Run in a background thread at startup. It never raises, so a provider being down cannot stop the app."""
    try:
        with SessionLocal() as db:
            if needs_refresh(db):
                refresh_jobs(db)
    except Exception:
        log.exception("startup refresh failed")
