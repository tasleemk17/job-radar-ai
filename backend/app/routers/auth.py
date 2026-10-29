from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Profile, User
from ..schemas import Credentials, TokenOut
from ..security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: Credentials, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists")
    db.add(Profile(user_id=user.id))
    db.commit()
    return TokenOut(token=create_token(user.id), email=email)


@router.post("/login", response_model=TokenOut)
def login(body: Credentials, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    # Same message for "no such user" and "wrong password" so emails cannot be probed
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return TokenOut(token=create_token(user.id), email=email)


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"email": user.email}
