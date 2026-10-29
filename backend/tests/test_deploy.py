"""The pieces that only matter once the app runs on a hosted server."""

from datetime import timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config
from app.db import Base, normalize_url
from app.ingest import needs_refresh
from app.models import Job, utcnow


def test_database_urls_from_hosts_work_as_pasted():
    assert normalize_url("postgresql://u:p@host/db?sslmode=require") == "postgresql+psycopg://u:p@host/db?sslmode=require"
    assert normalize_url("postgres://u:p@host/db") == "postgresql+psycopg://u:p@host/db"
    assert normalize_url("postgresql+psycopg://u:p@host/db") == "postgresql+psycopg://u:p@host/db"  # already right
    assert normalize_url("sqlite:///./jobradar.db") == "sqlite:///./jobradar.db"


def _job(source: str, age_hours: float) -> Job:
    return Job(source=source, external_id=f"{source}-{age_hours}", title="Dev", company="X", description="", created_at=utcnow() - timedelta(hours=age_hours))


def test_startup_refresh_is_needed_only_when_real_jobs_are_missing_or_old(monkeypatch):
    monkeypatch.setattr(config, "REFRESH_HOURS", 6)
    engine = create_engine("sqlite://")  # its own empty database, so the shared test data is untouched
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        assert needs_refresh(db) is True  # nothing at all

        db.add_all([_job("demo", 1), _job("manual", 1)])
        db.commit()
        assert needs_refresh(db) is True  # demo and hand-added jobs do not count as fetched

        db.add(_job("adzuna", 12))
        db.commit()
        assert needs_refresh(db) is True  # the newest fetched job is 12h old, more than 6h

        db.add(_job("jooble", 2))
        db.commit()
        assert needs_refresh(db) is False  # fresh enough
