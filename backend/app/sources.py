"""Job sources. Only providers that offer an API for this use:

  Remotive, Arbeitnow   public, no key
  Adzuna, Jooble        free API keys; each switches on when its key is set (see config.py)

No LinkedIn, Naukri, Indeed, Glassdoor or Foundit scraping: it breaks their terms and gets blocked anyway.
Every job keeps the link back to the original posting, as the providers ask.
"""

import hashlib
import html
import re
from datetime import datetime, timezone

import httpx

from . import config

REMOTIVE_URL = "https://remotive.com/api/remote-jobs?limit=150"
ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api"
ADZUNA_URL = "https://api.adzuna.com/v1/api/jobs/{country}/search/{page}"
ADZUNA_PER_PAGE = 50
JOOBLE_PER_PAGE = 20
JOOBLE_URL = "https://jooble.org/api/{key}"
_HEADERS = {"User-Agent": "JobRadar/1.0 (portfolio project)"}

MAX_QUERIES = 6  # each query is one API call per provider, so the number is capped
_CURRENCY = {"in": "INR", "gb": "GBP", "us": "USD", "au": "AUD", "ca": "CAD", "sg": "SGD"}
_WORLDWIDE = {"", "india", "remote", "anywhere", "worldwide"}


def _clean(raw: str | None) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw or ""))
    return re.sub(r"\s+", " ", text).strip()


def _iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt
    except (ValueError, AttributeError):
        return None


def _looks_remote(text: str) -> bool:
    """Adzuna and Jooble have no remote flag, so it is read from the text."""
    return bool(re.search(r"\bremote\b|work from home|\bwfh\b", text.lower()))


# ---------- parsers: one provider's JSON in, our job dicts out ----------

def parse_remotive(payload: dict) -> list[dict]:
    jobs = []
    for item in payload.get("jobs", []):
        if not item.get("id") or not item.get("title"):
            continue
        jobs.append(
            {
                "source": "remotive",
                "external_id": str(item["id"]),
                "title": item["title"].strip(),
                "company": (item.get("company_name") or "Unknown").strip(),
                "location": (item.get("candidate_required_location") or "Anywhere").strip(),
                "remote": True,
                "url": item.get("url") or "",
                "salary": (item.get("salary") or "").strip() or None,
                "description": _clean(item.get("description")),
                "tags": [t for t in item.get("tags", []) if isinstance(t, str)][:12],
                "posted_at": _iso(item.get("publication_date")),
            }
        )
    return jobs


def parse_arbeitnow(payload: dict) -> list[dict]:
    jobs = []
    for item in payload.get("data", []):
        if not item.get("slug") or not item.get("title"):
            continue
        created = item.get("created_at")
        jobs.append(
            {
                "source": "arbeitnow",
                "external_id": item["slug"],
                "title": item["title"].strip(),
                "company": (item.get("company_name") or "Unknown").strip(),
                "location": (item.get("location") or "").strip(),
                "remote": bool(item.get("remote")),
                "url": item.get("url") or "",
                "salary": None,
                "description": _clean(item.get("description")),
                "tags": [t for t in item.get("tags", []) if isinstance(t, str)][:12],
                "posted_at": datetime.fromtimestamp(created, timezone.utc).replace(tzinfo=None)
                if isinstance(created, (int, float))
                else None,
            }
        )
    return jobs


def _adzuna_salary(item: dict, country: str) -> str | None:
    lo, hi = item.get("salary_min"), item.get("salary_max")
    if str(item.get("salary_is_predicted")) == "1":  # Adzuna's own guess, not the employer's figure
        return None
    if not isinstance(lo, (int, float)) or not isinstance(hi, (int, float)) or hi <= 0:
        return None
    unit = _CURRENCY.get(country, "")
    amount = f"{lo:,.0f}" if round(lo) == round(hi) else f"{lo:,.0f} - {hi:,.0f}"
    return f"{unit} {amount}".strip() + " / year"


def parse_adzuna(payload: dict, country: str = "in") -> list[dict]:
    jobs = []
    for item in payload.get("results", []):
        if not item.get("id") or not item.get("title") or not item.get("redirect_url"):
            continue
        title = _clean(item["title"])  # Adzuna wraps search words in <strong>
        description = _clean(item.get("description"))
        location = _clean((item.get("location") or {}).get("display_name"))
        tags = [t for t in ((item.get("category") or {}).get("label"), item.get("contract_time")) if t]
        jobs.append(
            {
                "source": "adzuna",
                "external_id": str(item["id"]),
                "title": title,
                "company": _clean((item.get("company") or {}).get("display_name")) or "Unknown",
                "location": location,
                "remote": _looks_remote(f"{title} {location} {description}"),
                "url": item["redirect_url"],
                "salary": _adzuna_salary(item, country),
                "description": description,
                "tags": [str(t) for t in tags][:6],
                "posted_at": _iso(item.get("created")),
            }
        )
    return jobs


def parse_jooble(payload: dict) -> list[dict]:
    jobs = []
    for item in payload.get("jobs", []):
        link, title = item.get("link"), _clean(item.get("title"))
        if not link or not title:
            continue
        # Not every Jooble row has an id; the link is stable, so its hash stands in
        external_id = str(item.get("id") or hashlib.sha1(link.encode()).hexdigest()[:20])
        location = _clean(item.get("location"))
        snippet = _clean(item.get("snippet"))
        jobs.append(
            {
                "source": "jooble",
                "external_id": external_id,
                "title": title,
                "company": _clean(item.get("company")) or _clean(item.get("source")) or "Unknown",
                "location": location,
                "remote": _looks_remote(f"{title} {location} {snippet}"),
                "url": link,
                "salary": _clean(item.get("salary")) or None,
                "description": snippet,
                "tags": [t for t in (_clean(item.get("type")),) if t],
                "posted_at": _iso(item.get("updated")),
            }
        )
    return jobs


# ---------- fetching ----------

def _json(method: str, url: str, **kwargs):
    response = httpx.request(method, url, headers=_HEADERS, timeout=20, follow_redirects=True, **kwargs)
    response.raise_for_status()
    return response.json()


def _describe(exc: Exception) -> str:
    """A short reason that is safe to show. It never includes the URL, because Adzuna and Jooble
    keys travel in the URL and an exception message would print them."""
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}"
    if isinstance(exc, httpx.TimeoutException):
        return "timed out"
    if isinstance(exc, httpx.HTTPError):
        return "network error"
    return "unexpected response"


def _place(location: str | None) -> str:
    """A specific place ("Pune") narrows the search; "India" or "remote" would only confuse it."""
    place = (location or "").strip()
    return "" if place.lower() in _WORLDWIDE else place


def build_queries(roles: str | None) -> list[str]:
    """The person's wanted roles first, then the default searches, without repeats."""
    wanted = [r.strip() for r in re.split(r"[,;\n]+", roles or "") if r.strip()]
    seen, out = set(), []
    for query in wanted + config.JOB_QUERIES:
        key = query.lower()
        if key not in seen:
            seen.add(key)
            out.append(query)
    return out[:MAX_QUERIES]


def fetch_adzuna(queries: list[str], location: str | None) -> list[dict]:
    jobs = []
    for query in queries:
        params = {
            "app_id": config.ADZUNA_APP_ID,
            "app_key": config.ADZUNA_APP_KEY,
            "results_per_page": ADZUNA_PER_PAGE,
            "what": query,
            "sort_by": "date",
            "max_days_old": 30,
            "content-type": "application/json",
        }
        if _place(location):
            params["where"] = _place(location)
        for page in range(1, config.ADZUNA_PAGES + 1):
            payload = _json("GET", ADZUNA_URL.format(country=config.ADZUNA_COUNTRY, page=page), params=params)
            jobs.extend(parse_adzuna(payload, config.ADZUNA_COUNTRY))
            if len(payload.get("results", [])) < ADZUNA_PER_PAGE:
                break  # a short page was the last one, so asking for the next would be a wasted call
    return jobs


def fetch_jooble(queries: list[str], location: str | None) -> list[dict]:
    """`location` (the person's city) is not used: Jooble answers a city with 0 jobs and a country with the
    real list, so the country from config is always sent. Scoring against the resume does the narrowing."""
    jobs = []
    for query in queries:
        for page in range(1, config.JOOBLE_PAGES + 1):
            body = {"keywords": query, "location": config.JOOBLE_LOCATION, "page": page}
            payload = _json("POST", JOOBLE_URL.format(key=config.JOOBLE_API_KEY), json=body)
            jobs.extend(parse_jooble(payload))
            if len(payload.get("jobs", [])) < JOOBLE_PER_PAGE:
                break  # a short page was the last one
    return jobs


def fetch_all(queries: list[str] | None = None, location: str | None = None) -> tuple[list[dict], dict[str, str], list[str]]:
    """Returns (jobs, errors, skipped). One provider being down never stops the others, and a provider
    without a key is reported as skipped, not as an error."""
    queries = queries or build_queries(None)
    location = config.JOB_LOCATION if location is None else location
    providers = [
        ("remotive", True, lambda: parse_remotive(_json("GET", REMOTIVE_URL))),
        ("arbeitnow", True, lambda: parse_arbeitnow(_json("GET", ARBEITNOW_URL))),
        ("adzuna", bool(config.ADZUNA_APP_ID and config.ADZUNA_APP_KEY), lambda: fetch_adzuna(queries, location)),
        ("jooble", bool(config.JOOBLE_API_KEY), lambda: fetch_jooble(queries, location)),
    ]
    jobs: list[dict] = []
    errors: dict[str, str] = {}
    skipped: list[str] = []
    for name, enabled, run in providers:
        if not enabled:
            skipped.append(name)
            continue
        try:
            jobs.extend(run())
        except Exception as exc:  # a surprising payload from one provider must not break the others
            errors[name] = _describe(exc)
    return jobs, errors, skipped
