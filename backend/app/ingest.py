import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import SessionLocal
from .demo_jobs import DEMO_JOBS
from .embeddings import embed
from .models import Job
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
