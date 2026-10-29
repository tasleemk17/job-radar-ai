import os
from pathlib import Path


def _load_env_files() -> None:
    """Reads KEY=VALUE lines from backend/.env and the project .env, so local runs need no exported variables.
    Variables that are already set (Docker, the shell, tests) always win."""
    here = Path(__file__).resolve().parent.parent
    for path in (here / ".env", here.parent / ".env"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_env_files()


def _flag(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


# SQLite works with zero setup. For Postgres (for example Supabase) set
# DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db and install psycopg[binary].
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./jobradar.db")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-secret-change-me-before-deploying-1234567890")
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "72"))

# Without a key every AI feature falls back to a rule-based answer, so the app still works.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
# A small model is cheap and plenty for short structured answers and cover letters.
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-5-5")

# Optional job sources. Remotive and Arbeitnow need no key. These two switch on when a key is set.
# Adzuna: free keys at https://developer.adzuna.com (covers India with country "in").
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "").strip()
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "").strip()
ADZUNA_COUNTRY = os.getenv("ADZUNA_COUNTRY", "in").strip().lower()
# Adzuna returns 50 jobs per page. One page per search kept returning the same newest 50, so several
# pages are read. Each page is one API call (free keys allow a few hundred a day), hence the cap of 5.
ADZUNA_PAGES = max(1, min(5, int(os.getenv("ADZUNA_PAGES", "3"))))
# Jooble: free key at https://jooble.org/api/about
JOOBLE_API_KEY = os.getenv("JOOBLE_API_KEY", "").strip()

# What Adzuna and Jooble are asked for when nobody's resume roles are known yet (scheduled refresh)
JOB_QUERIES = _list("JOB_QUERIES", "software developer,full stack developer,python developer,react developer,backend developer")
JOB_LOCATION = os.getenv("JOB_LOCATION", "India").strip()

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5180").split(",") if o.strip()]

ENABLE_SCHEDULER = _flag("ENABLE_SCHEDULER", True)
REFRESH_HOURS = int(os.getenv("REFRESH_HOURS", "6"))
SEED_DEMO = _flag("SEED_DEMO", True)

AI_CALLS_PER_HOUR = int(os.getenv("AI_CALLS_PER_HOUR", "30"))
