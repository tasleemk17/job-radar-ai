from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..matching import score
from ..models import STATUSES, Application, Job, Profile, User, utcnow
from ..security import current_user
from ..visibility import has_fetched_jobs

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def stats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    apps = list(db.scalars(select(Application).where(Application.user_id == user.id)).unique())
    by_status = Counter(a.status for a in apps)
    funnel = [{"status": s, "count": by_status.get(s, 0)} for s in STATUSES]

    # Applications created per week for the last 8 weeks, oldest first
    now = utcnow()
    weekly = []
    for i in range(7, -1, -1):
        start, end = now - timedelta(weeks=i + 1), now - timedelta(weeks=i)
        weekly.append({"week": end.strftime("%d %b"), "count": sum(1 for a in apps if start < a.created_at <= end)})

    # What the best-matching jobs ask for that you do not have: the skills worth learning next
    profile = db.get(Profile, user.id)
    top, gap = [], Counter()
    # Demo jobs are made up, so once real jobs exist they must not shape the numbers
    real_only = has_fetched_jobs(db)
    jobs_query = select(Job).where(Job.source != "demo") if real_only else select(Job)
    if profile and profile.resume_text.strip():
        scored = [(job, score(profile, job)) for job in db.scalars(jobs_query.order_by(Job.id.desc()).limit(400))]
        scored.sort(key=lambda p: p[1].score, reverse=True)
        top = scored[:30]
        for _, match in top:
            gap.update(match.missing)

    answered = by_status.get("interview", 0) + by_status.get("offer", 0) + by_status.get("rejected", 0)
    sent = sum(n for s, n in by_status.items() if s != "saved")
    return {
        "funnel": funnel,
        "weekly": weekly,
        "skill_gap": [{"skill": s, "jobs": n} for s, n in gap.most_common(8)],
        "avg_top_match": round(sum(m.score for _, m in top[:10]) / len(top[:10])) if top else None,
        "response_rate": round(100 * answered / sent) if sent else None,
        "tracked": len(apps),
        "total_jobs": db.scalar(select(func.count()).select_from(jobs_query.subquery())),
    }
