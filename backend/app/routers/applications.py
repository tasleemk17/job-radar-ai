from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..matching import score
from ..models import Application, Job, Profile, User, utcnow
from ..schemas import ApplicationIn, ApplicationOut, ApplicationPatch
from ..security import current_user
from .jobs import serialize

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _out(app: Application, profile: Profile | None) -> ApplicationOut:
    return ApplicationOut(
        id=app.id, status=app.status, notes=app.notes, applied_at=app.applied_at, updated_at=app.updated_at,
        job=serialize(app.job, score(profile, app.job), app.status),
    )


def _owned(db: Session, user: User, app_id: int) -> Application:
    app = db.get(Application, app_id)
    if app is None or app.user_id != user.id:  # 404 for other people's rows too, never confirm they exist
        raise HTTPException(404, "Application not found")
    return app


def _set_status(app: Application, status: str) -> None:
    app.status = status
    if status != "saved" and app.applied_at is None:
        app.applied_at = utcnow()


@router.get("", response_model=list[ApplicationOut])
def list_applications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = db.get(Profile, user.id)
    rows = db.scalars(select(Application).where(Application.user_id == user.id).order_by(Application.updated_at.desc()))
    return [_out(a, profile) for a in rows.unique()]


@router.post("", response_model=ApplicationOut, status_code=201)
def create_application(body: ApplicationIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if db.get(Job, body.job_id) is None:
        raise HTTPException(404, "Job not found")
    existing = db.scalar(select(Application).where(Application.user_id == user.id, Application.job_id == body.job_id))
    if existing:
        raise HTTPException(409, "You are already tracking this job")
    app = Application(user_id=user.id, job_id=body.job_id)
    _set_status(app, body.status)
    db.add(app)
    db.commit()
    db.refresh(app)
    return _out(app, db.get(Profile, user.id))


@router.patch("/{app_id}", response_model=ApplicationOut)
def update_application(app_id: int, body: ApplicationPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = _owned(db, user, app_id)
    if body.status is not None:
        _set_status(app, body.status)
    if body.notes is not None:
        app.notes = body.notes
    db.commit()
    db.refresh(app)
    return _out(app, db.get(Profile, user.id))


@router.delete("/{app_id}", status_code=204)
def delete_application(app_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, user, app_id))
    db.commit()
