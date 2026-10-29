"""When the built-in demo jobs should be hidden.

They exist so the app is not empty on the first run. Once real jobs have been fetched they only get in
the way (their links are fake), so they are hidden unless the person asks for them. Jobs a person adds
by hand count as neither demo nor fetched, so adding one does not hide the demo set."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Job

_NOT_FETCHED = ("demo", "manual")


def has_fetched_jobs(db: Session) -> bool:
    return bool(db.scalar(select(func.count()).select_from(Job).where(Job.source.not_in(_NOT_FETCHED))))


def has_demo_jobs(db: Session) -> bool:
    return bool(db.scalar(select(func.count()).select_from(Job).where(Job.source == "demo")))


def demo_is_optional(db: Session) -> bool:
    """True when both kinds exist, which is when the screen should offer a "Show demo jobs" switch."""
    return has_demo_jobs(db) and has_fetched_jobs(db)
