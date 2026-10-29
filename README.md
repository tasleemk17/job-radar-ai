# Job Radar

Job search with an AI layer. It pulls real jobs from public APIs, scores every one against **your resume**, explains the gaps, writes a cover letter, and tracks each application on a board.

**Stack:** React 19 + TypeScript + Tailwind, FastAPI, SQLAlchemy, Claude API, Docker.

## Screenshots

Light (the default) and dark, switched with one click.

### Jobs, ranked by how well they match your resume

| Light | Dark |
|---|---|
| ![Jobs ranked by match score](docs/screenshots/jobs-light.png) | ![Jobs ranked by match score, dark mode](docs/screenshots/jobs-dark.png) |

### Four job sources in one place

Adzuna, Jooble, Arbeitnow and Remotive, each job tagged with where it came from.

| Light | Dark |
|---|---|
| ![Jobs from the four sources](docs/screenshots/sources-light.png) | ![Jobs from the four sources, dark mode](docs/screenshots/sources-dark.png) |

### Apply

Cover letter and resume ready to copy, then straight to the company's own application page.

| Light | Dark |
|---|---|
| ![Apply panel in the job drawer](docs/screenshots/apply-light.png) | ![Apply panel in the job drawer, dark mode](docs/screenshots/apply-dark.png) |

### Application board

Drag a card from Saved to Applied, Interview, Offer or Rejected.

![Application board, light mode](docs/screenshots/board-light.png)
![Application board, dark mode](docs/screenshots/board-dark.png)

### Dashboard

Funnel, response rate, and the skills worth learning next.

| Light | Dark |
|---|---|
| ![Dashboard with funnel, weekly chart and skill gaps](docs/screenshots/dashboard-light.png) | ![Dashboard with funnel, weekly chart and skill gaps, dark mode](docs/screenshots/dashboard-dark.png) |

### Profile

Paste a resume or upload a PDF. Skills are found automatically.

| Light | Dark |
|---|---|
| ![Profile page](docs/screenshots/profile-light.png) | ![Profile page, dark mode](docs/screenshots/profile-dark.png) |

### Sign in

| Light | Dark |
|---|---|
| ![Sign-in page](docs/screenshots/login-light.png) | ![Sign-in page, dark mode](docs/screenshots/login-dark.png) |

### On a phone

Bottom tab bar, filters that wrap, and cards that fit. Light on the top row, dark below.

<table>
  <tr>
    <td><img src="docs/screenshots/mobile-jobs-light.png" width="260" alt="Jobs on a phone, light"></td>
    <td><img src="docs/screenshots/mobile-board-light.png" width="260" alt="Board on a phone, light"></td>
    <td><img src="docs/screenshots/mobile-dashboard-light.png" width="260" alt="Dashboard on a phone, light"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/mobile-jobs-dark.png" width="260" alt="Jobs on a phone, dark"></td>
    <td><img src="docs/screenshots/mobile-board-dark.png" width="260" alt="Board on a phone, dark"></td>
    <td><img src="docs/screenshots/mobile-dashboard-dark.png" width="260" alt="Dashboard on a phone, dark"></td>
  </tr>
</table>

*The screenshots use a sample resume and real public job listings fetched from Adzuna, Jooble, Arbeitnow and Remotive.*

## What it does

| Feature | How it works |
|---|---|
| **Match score (0-100)** | Resume and job are compared by meaning (embeddings), by required skills, and by job title. See [How matching works](#how-matching-works). |
| **Fresh and real first** | A "Posted" filter (7 or 30 days). Newer jobs get a small lift in the ordering (up to +8 points, fading over 30 days) while the match score shown stays pure. The built-in demo jobs hide themselves once real jobs are fetched, with a "Show demo jobs" switch. |
| **Live jobs** | Four sources: Remotive and Arbeitnow (no key) plus **Adzuna** and **Jooble** (free keys, India coverage). New jobs are fetched every 6 hours and on demand, searching for the roles and city in your profile. A "demo" set ships so the app is useful offline. |
| **Skill gaps** | Each job lists the skills you have (green) and the ones you do not mention (amber). The dashboard totals them across your 30 best matches: the skills worth learning next. |
| **AI fit analysis** | Claude returns structured JSON (summary, strengths, gaps, tips). Cached per job and resume, so reopening costs nothing. |
| **Cover letter** | Streamed to the page word by word over Server-Sent Events. Three tones. |
| **Apply flow** | Cover letter (editable) and resume text ready to copy, one click to open the company's own application page (or an email draft for jobs that say "email your CV"), then confirm to mark the job Applied on the board. The final submit stays on the company's site; the app never sends anything for you. |
| **Application board** | Drag cards between Saved, Applied, Interview, Offer and Rejected. Moves are optimistic and roll back on error. |
| **Dashboard** | Funnel, applications per week, response rate, skill-gap chart. |
| **Resume upload** | Paste text or upload a PDF. |
| **Smooth, mobile-ready UI** | Light (default) and dark mode with a toggle that remembers your choice, inertia scrolling (Lenis, off for people who prefer reduced motion), page and list animations, sticky filters, drag overlay on the board with press-and-hold for touch, bottom tab bar on phones, toasts, press `/` to search. |

Works without an API key: analysis and letters fall back to rule-based answers, and everything else is unchanged.

## Run it

### With Docker

```bash
cp .env.example .env        # then set JWT_SECRET (and ANTHROPIC_API_KEY if you have one)
docker compose up -d --build
```

Open http://localhost:5180 and create an account.

### Turning on Adzuna and Jooble (optional)

Get a free key from each site, then put them in `backend/.env` (running directly) or `.env` (Docker):

```
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
JOOBLE_API_KEY=...
```

Restart the backend and press **Fetch new jobs**. Without keys those two are skipped and the app says so.

### For development

```bash
# terminal 1: API on :8000
cd backend
python -m venv .venv
.venv/Scripts/activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload

# terminal 2: website on :5180 (proxies /api to :8000)
cd frontend
npm install
npm run dev
```

### Tests

```bash
cd backend && pytest -q           # 38 tests
cd frontend && npm run build      # type-check + production build
```

## Deploy

Free hosting works: website on Vercel, API on Render, database on Neon (Postgres). Step by step in [docs/DEPLOY.md](docs/DEPLOY.md). `render.yaml` is the Render Blueprint.

## How matching works

```
score = 40% meaning + 45% skills + 15% title
```

- **Meaning:** cosine similarity between the resume vector and the job vector.
- **Skills:** the share of the job's listed skills that your resume has. Measured against at least 3 skills, so a job that lists one skill cannot give a "100% skills" result from a single hit.
- **Title:** one of your desired role words appears in the job title.

Skills come from a fixed vocabulary (`app/skills.py`) with word-boundary rules, so `java` does not match inside `javascript` and `rest` in prose is not a skill. A vocabulary is predictable and free; an LLM call per job would be neither.

## Design decisions

- **Hashing embeddings by default.** Words and word pairs are hashed into 512 buckets (`app/embeddings.py`). No model download, no GPU, deterministic tests. It is lexical, not semantic: "backend" and "server-side" are not close. Set `EMBEDDING_BACKEND=sentence-transformers` and install the package for real semantic vectors; nothing else changes.
- **SQLite by default, Postgres by URL.** SQLAlchemy keeps the code the same. Set `DATABASE_URL` to any Postgres URL (for example Neon or Supabase) and paste it as the host gives it: `postgresql://` is rewritten for the bundled psycopg 3 driver. The full test suite passes on both SQLite and Postgres 16 (`TEST_DATABASE_URL=postgresql://... pytest`). Embeddings are stored as JSON and compared in Python, which is fine for thousands of jobs; **pgvector** is the next step beyond that.
- **Legal sources only.** Remotive and Arbeitnow publish public APIs, and Adzuna and Jooble issue free API keys. Indeed, Glassdoor, Foundit, LinkedIn and Naukri have no public job-seeker API and forbid scraping, so they are not used (Adzuna already aggregates much of the same listings). Every job links back to the original posting, and API keys are never written to logs or error messages (they travel in the request URL, so error text is reduced to a status like `HTTP 401`).
- **LLM output is untrusted, and so is its input.** Resume and job text go inside tags and the system prompt says to treat them as data, never as instructions. Model replies are parsed and length-limited, and any failure (network, bad JSON, refusal, quota) falls back to the rule-based answer instead of an error page.
- **Dates from aggregators are not fully trusted.** Adzuna sometimes re-lists an old ad with a recent date, so a job can look newer than it is. The freshness lift and the Posted filter reduce the effect; the company's own page is the final word, and the Apply panel opens it.
- **Cost control.** Small model by default, cached analyses, and 30 AI calls per user per hour.
- **Security basics.** Passwords hashed with PBKDF2-SHA256 (200k rounds), JWT sessions, other users' rows return 404, the same error for unknown email and wrong password, only `http(s)` links are clickable, PDF uploads capped at 2 MB.

## API

All routes are under `/api` and need `Authorization: Bearer <token>` except register and login. Interactive docs: http://localhost:8000/docs when running the backend directly.

| Route | Purpose |
|---|---|
| `POST /auth/register`, `POST /auth/login` | Create account, sign in |
| `GET/PUT /profile`, `POST /profile/resume-pdf` | Resume, roles, detected skills |
| `GET /jobs` | Search and filter, ranked by match. Params: `q`, `remote`, `source`, `min_score`, `max_age_days`, `demo`, `sort`, `limit`, `offset` |
| `GET /jobs/{id}`, `POST /jobs`, `POST /jobs/refresh` | Detail, add your own, fetch new |
| `GET/POST /applications`, `PATCH/DELETE /applications/{id}` | The board |
| `POST /ai/analyze`, `POST /ai/cover-letter` | Fit analysis (JSON), cover letter (SSE stream) |
| `GET /stats` | Dashboard numbers |

## Configuration

| Variable | Default | |
|---|---|---|
| `JWT_SECRET` | dev value | **Set a long random value in production** |
| `ANTHROPIC_API_KEY` | empty | Turns Claude on |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | |
| `DATABASE_URL` | `sqlite:///./jobradar.db` | |
| `CORS_ORIGINS` | `http://localhost:5180` | Website addresses allowed to call the API, comma separated. Needed when the site and API are on different hosts |
| `REFRESH_ON_START` | `true` | Refresh jobs in the background at startup when the newest fetched job is older than `REFRESH_HOURS` (a free host sleeps, so the timer alone is not enough) |
| `REFRESH_HOURS` | `6` | Job refresh interval |
| `AI_CALLS_PER_HOUR` | `30` | Per user |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | empty | Turns Adzuna on. Free keys at developer.adzuna.com |
| `ADZUNA_COUNTRY` | `in` | Adzuna country code (`in` is India) |
| `ADZUNA_PAGES` | `3` | Pages (50 jobs each) read per search, 1 to 5. Each page is one API call |
| `JOOBLE_API_KEY` | empty | Turns Jooble on. Free key at jooble.org/api/about |
| `JOOBLE_LOCATION` | `India` | Jooble only understands a country as the place (a city returns 0 jobs), so this is always sent |
| `JOOBLE_PAGES` | `3` | Pages (20 jobs each) read per search, 1 to 5 |
| `JOB_LOCATION` | `India` | Used when your profile has no city |
| `EMBEDDING_BACKEND` | hashing | `sentence-transformers` for semantic vectors |

## Project layout

```
backend/app/
  main.py  config.py  db.py  models.py  schemas.py  security.py
  embeddings.py  skills.py  matching.py     # the matching engine
  ai.py                                      # Claude calls + fallbacks
  sources.py  ingest.py  demo_jobs.py        # job intake (4 providers)
  visibility.py  ratelimit.py
  routers/  auth profile jobs applications ai stats
backend/tests/                               # matching, sources, full API flow
frontend/src/
  pages/  Login Jobs Board Dashboard Profile
  components/  JobDrawer ApplyPanel JobCard ScoreRing Segmented
               Layout ThemeToggle Toast SmoothScroll
  api.ts (fetch + SSE reader)  auth.tsx  theme.tsx  scroll.ts
```

## Roadmap

- pgvector instead of in-Python similarity
- Semantic embeddings on by default
- An eval set that measures how well the score ranks jobs a person would actually apply to
- Email digest of the best new matches
