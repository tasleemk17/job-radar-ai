import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import ai
from ..db import get_db
from ..matching import score
from ..models import Analysis, Job, Profile, User
from ..ratelimit import check_ai_limit
from ..schemas import AnalyzeIn, CoverLetterIn
from ..security import current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _need_profile(db: Session, user: User) -> Profile:
    profile = db.get(Profile, user.id)
    if profile is None or not profile.resume_text.strip():
        raise HTTPException(422, "Add your resume on the Profile page first")
    return profile


def _need_job(db: Session, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/status")
def status():
    return {"claude": ai.enabled()}


@router.post("/analyze", response_model=ai.Analysis)
def analyze(body: AnalyzeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _need_profile(db, user)
    job = _need_job(db, body.job_id)
    # The stamp changes whenever the resume changes, which makes an old cached answer stale
    stamp = int(profile.updated_at.timestamp()) if profile.updated_at else 0
    cached = db.scalar(select(Analysis).where(Analysis.user_id == user.id, Analysis.job_id == job.id))
    if cached and cached.profile_stamp == stamp and not body.refresh:
        return ai.Analysis(**cached.data)

    check_ai_limit(user.id)
    result = ai.analyze(profile, job, score(profile, job))
    if cached:
        cached.data, cached.profile_stamp = result.model_dump(), stamp
    else:
        db.add(Analysis(user_id=user.id, job_id=job.id, profile_stamp=stamp, data=result.model_dump()))
    db.commit()
    return result


@router.post("/cover-letter")
def cover_letter(body: CoverLetterIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _need_profile(db, user)
    job = _need_job(db, body.job_id)
    check_ai_limit(user.id)
    match = score(profile, job)

    def events():
        for piece in ai.stream_cover_letter(profile, job, match, body.tone):
            yield f"data: {json.dumps({'t': piece})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
