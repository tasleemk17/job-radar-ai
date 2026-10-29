"""Match score between a profile and a job, 0 to 100.

Three signals, each easy to explain in an interview:
  meaning  (40%)  cosine similarity of resume and job embeddings
  skills   (45%)  share of the job's required skills that the resume has
  title    (15%)  a desired role word appears in the job title
"""

import re
from dataclasses import dataclass
from datetime import datetime

from .embeddings import cosine
from .models import Job, Profile, utcnow

W_MEANING, W_SKILLS, W_TITLE = 0.40, 0.45, 0.15
# Hashed embeddings of long documents rarely exceed ~0.5 cosine, so scale before weighting
_COSINE_FULL = 0.45
MIN_SKILLS_BASIS = 3


FRESH_MAX_BONUS = 8.0
FRESH_DAYS = 30


def freshness_bonus(posted_at: datetime | None, now: datetime | None = None) -> float:
    """Used only to order a list, never added to the score a person sees. A job posted today gets up to
    +8 points of ranking, fading to nothing at 30 days, so equally good matches show the newer one first
    without a weak new job beating a strong older one."""
    if posted_at is None:
        return 0.0
    age_days = max(0.0, ((now or utcnow()) - posted_at).total_seconds() / 86400)
    return max(0.0, FRESH_MAX_BONUS * (1 - age_days / FRESH_DAYS))


@dataclass
class Match:
    score: int
    matched: list[str]
    missing: list[str]


def _role_words(roles: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9+#]+", roles.lower()) if len(w) > 2 and w not in {"and", "the", "engineer", "developer"}}


def score(profile: Profile | None, job: Job) -> Match | None:
    if profile is None or not profile.resume_text.strip():
        return None

    mine, wanted = set(profile.skills or []), set(job.skills or [])
    matched = sorted(mine & wanted)
    missing = sorted(wanted - mine)

    meaning = min(1.0, cosine(profile.embedding or [], job.embedding or []) / _COSINE_FULL)
    # A job that lists one skill must not earn "100% skills" from a single hit, so the share is
    # measured against at least MIN_SKILLS_BASIS skills. No listed skills at all: fall back to meaning.
    skills = len(matched) / max(len(wanted), MIN_SKILLS_BASIS) if wanted else meaning
    words = _role_words(profile.roles or "")
    title = 1.0 if words and words & set(re.findall(r"[a-z0-9+#]+", job.title.lower())) else 0.0

    total = 100 * (W_MEANING * meaning + W_SKILLS * skills + W_TITLE * title)
    return Match(score=max(0, min(100, round(total))), matched=matched, missing=missing)
