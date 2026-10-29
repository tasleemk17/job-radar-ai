import time
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import config
from ..db import get_db
from ..embeddings import embed
from ..ingest import refresh_jobs
from ..matching import Match, freshness_bonus, score
from ..models import Application, Job, Profile, User, utcnow
from ..schemas import JobDetail, JobIn, JobList, JobOut
from ..security import current_user
from ..skills import extract_skills
from ..sources import build_queries
from ..visibility import demo_is_optional, has_fetched_jobs

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

CANDIDATE_LIMIT = 600  # newest jobs scored per request; plenty for thousands of rows
REFRESH_COOLDOWN = 300  # seconds between manual refreshes, so the public APIs are not hammered
_last_refresh = 0.0


def serialize(job: Job, match: Match | None = None, status: str | None = None, full: bool = False):
    data = dict(
        id=job.id, source=job.source, title=job.title, company=job.company, location=job.location,
        remote=job.remote, url=job.url, salary=job.salary, posted_at=job.posted_at,
        tags=job.tags or [], skills=job.skills or [], snippet=job.description[:260],
        score=match.score if match else None,
        matched=match.matched if match else [], missing=match.missing if match else [],
        status=status,
    )
    return JobDetail(**data, description=job.description) if full else JobOut(**data)


def statuses_for(db: Session, user: User) -> dict[int, str]:
    return dict(db.execute(select(Application.job_id, Application.status).where(Application.user_id == user.id)).all())


@router.get("", response_model=JobList)
def list_jobs(
    q: str = "",
    remote: bool | None = None,
    source: str | None = None,
    min_score: int = Query(0, ge=0, le=100),
    max_age_days: int | None = Query(None, ge=1, le=365),
    demo: bool = False,
    sort: str = Query("match", pattern="^(match|recent)$"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    posted = func.coalesce(Job.posted_at, Job.created_at)
    stmt = select(Job)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Job.company.ilike(like), Job.description.ilike(like)))
    if remote is not None:
        stmt = stmt.where(Job.remote == remote)
    if source:
        stmt = stmt.where(Job.source == source)
    if max_age_days:
        stmt = stmt.where(posted >= utcnow() - timedelta(days=max_age_days))
    # Demo jobs step aside once real ones exist, unless they were asked for (switch, or the demo source filter)
    if not demo and source != "demo" and has_fetched_jobs(db):
        stmt = stmt.where(Job.source != "demo")
    stmt = stmt.order_by(posted.desc()).limit(CANDIDATE_LIMIT)

    profile = db.get(Profile, user.id)
    status = statuses_for(db, user)
    rows = [(job, score(profile, job)) for job in db.scalars(stmt)]
    if min_score:
        rows = [(j, m) for j, m in rows if m and m.score >= min_score]
    if sort == "match" and any(m for _, m in rows):
        # The match score stays as it is; newer postings only get a small lift in the ordering
        rows.sort(key=lambda p: p[1].score + freshness_bonus(p[0].posted_at or p[0].created_at) if p[1] else -1, reverse=True)

    page = rows[offset : offset + limit]
    return JobList(total=len(rows), items=[serialize(j, m, status.get(j.id)) for j, m in page], demo_available=demo_is_optional(db))


@router.get("/sources")
def sources(user: User = Depends(current_user), db: Session = Depends(get_db)):
    counts = db.execute(select(Job.source, func.count()).group_by(Job.source)).all()
    return {name: n for name, n in counts}


@router.post("/refresh")
def refresh(user: User = Depends(current_user), db: Session = Depends(get_db)):
    global _last_refresh
    wait = REFRESH_COOLDOWN - (time.time() - _last_refresh)
    if wait > 0:
        raise HTTPException(429, f"Jobs were refreshed a moment ago. Try again in {int(wait)} seconds.")
    _last_refresh = time.time()
    # Search for what this person wants: their roles and city come first, the default searches fill the rest
    profile = db.get(Profile, user.id)
    queries = build_queries(profile.roles if profile else None)
    location = profile.location if profile and profile.location.strip() else None
    return refresh_jobs(db, queries, config.JOB_LOCATION if location is None else location)


@router.post("", response_model=JobDetail, status_code=201)
def add_job(body: JobIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Lets a user add a posting they found elsewhere, so it is scored and tracked like the rest."""
    text = f"{body.title}. {body.description}"
    job = Job(
        source="manual", external_id=f"user-{user.id}-{int(time.time() * 1000)}",
        title=body.title.strip(), company=body.company.strip(), location=body.location.strip(),
        remote=body.remote, url=body.url.strip(), description=body.description.strip(),
        tags=[], skills=extract_skills(text), embedding=embed(text),
    )
    db.add(job)
    db.commit()
    return serialize(job, score(db.get(Profile, user.id), job), full=True)


@router.get("/{job_id}", response_model=JobDetail)
def job_detail(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return serialize(job, score(db.get(Profile, user.id), job), statuses_for(db, user).get(job_id), full=True)
