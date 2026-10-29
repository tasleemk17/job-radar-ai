from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Status = Literal["saved", "applied", "interview", "offer", "rejected"]


class Credentials(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    password: str = Field(min_length=8, max_length=128)


class TokenOut(BaseModel):
    token: str
    email: str


class ProfileIn(BaseModel):
    resume_text: str = Field(default="", max_length=20000)
    roles: str = Field(default="", max_length=300)
    location: str = Field(default="", max_length=120)
    extra_skills: list[str] = Field(default_factory=list, max_length=40)


class ProfileOut(BaseModel):
    resume_text: str
    roles: str
    location: str
    skills: list[str]
    ready: bool


class JobIn(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    company: str = Field(min_length=1, max_length=200)
    location: str = Field(default="", max_length=200)
    remote: bool = False
    # Only a web link or a plain mailto: address (for jobs that say "email your CV to ..."), never javascript:
    url: str = Field(default="", max_length=600, pattern=r"^(https?://\S+|mailto:[^\s?@]+@[^\s?@]+\.[^\s?@]+)?$")
    description: str = Field(default="", max_length=20000)


class JobOut(BaseModel):
    id: int
    source: str
    title: str
    company: str
    location: str
    remote: bool
    url: str
    salary: str | None
    posted_at: datetime | None
    tags: list[str]
    skills: list[str]
    snippet: str
    score: int | None = None
    matched: list[str] = []
    missing: list[str] = []
    status: str | None = None


class JobDetail(JobOut):
    description: str


class JobList(BaseModel):
    total: int
    items: list[JobOut]
    demo_available: bool = False  # demo and fetched jobs both exist, so the screen can offer a "Show demo jobs" switch


class ApplicationIn(BaseModel):
    job_id: int
    status: Status = "saved"


class ApplicationPatch(BaseModel):
    status: Status | None = None
    notes: str | None = Field(default=None, max_length=5000)


class ApplicationOut(BaseModel):
    id: int
    status: str
    notes: str
    applied_at: datetime | None
    updated_at: datetime
    job: JobOut


class AnalyzeIn(BaseModel):
    job_id: int
    refresh: bool = False


class CoverLetterIn(BaseModel):
    job_id: int
    tone: Literal["professional", "friendly", "concise"] = "professional"
