import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pypdf import PdfReader
from sqlalchemy.orm import Session

from ..db import get_db
from ..embeddings import embed
from ..models import Profile, User
from ..schemas import ProfileIn, ProfileOut
from ..security import current_user
from ..skills import extract_skills

router = APIRouter(prefix="/api/profile", tags=["profile"])

MAX_PDF_BYTES = 2 * 1024 * 1024


def _get(db: Session, user: User) -> Profile:
    profile = db.get(Profile, user.id)
    if profile is None:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.flush()
    return profile


def _out(profile: Profile) -> ProfileOut:
    return ProfileOut(
        resume_text=profile.resume_text,
        roles=profile.roles,
        location=profile.location,
        skills=profile.skills or [],
        ready=bool(profile.resume_text.strip()),
    )


@router.get("", response_model=ProfileOut)
def read_profile(user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _get(db, user)
    db.commit()
    return _out(profile)


@router.put("", response_model=ProfileOut)
def save_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _get(db, user)
    profile.resume_text = body.resume_text.strip()
    profile.roles = body.roles.strip()
    profile.location = body.location.strip()
    extra = {s.strip().lower() for s in body.extra_skills if s.strip()}
    profile.skills = sorted(set(extract_skills(profile.resume_text)) | extra)
    profile.embedding = embed(f"{profile.roles}. {profile.resume_text}") if profile.resume_text else []
    db.commit()
    return _out(profile)


@router.post("/resume-pdf")
async def resume_from_pdf(file: UploadFile = File(...), user: User = Depends(current_user)):
    """Reads the text out of a PDF resume. The client then shows it for review and saves it."""
    data = await file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(413, "PDF is larger than 2 MB")
    try:
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages[:10]).strip()
    except Exception:
        raise HTTPException(400, "This does not look like a readable PDF")
    if not text:
        raise HTTPException(422, "No text found. Scanned PDFs are not supported; paste the text instead.")
    return {"text": text[:20000]}
