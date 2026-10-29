import json
from datetime import timedelta

import pytest
from sqlalchemy import delete

from app.db import SessionLocal
from app.embeddings import embed
from app.models import Job, utcnow
from app.skills import extract_skills


@pytest.fixture
def fetched_jobs():
    """Three real-looking jobs with the same text but different ages, removed again afterwards so the other
    tests still see only the demo set."""
    text = "ZZ Role. React and Node.js and Docker role."

    def job(key, age_days):
        return Job(
            source="adzuna", external_id=f"zz-{key}", title="ZZ Role", company=f"ZZ {key} Co", location="Pune", remote=False,
            url="https://example.org/x", description="React and Node.js and Docker role.", tags=[],
            skills=extract_skills(text), embedding=embed(text), posted_at=utcnow() - timedelta(days=age_days),
        )

    with SessionLocal() as db:
        db.add_all([job("fresh", 0), job("mid", 10), job("old", 60)])
        db.commit()
    yield
    with SessionLocal() as db:
        db.execute(delete(Job).where(Job.external_id.like("zz-%")))
        db.commit()


def test_register_login_and_duplicate(client):
    body = {"email": "Dup@Example.com", "password": "correct-horse-1"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    assert client.post("/api/auth/register", json=body).status_code == 409
    assert client.post("/api/auth/login", json=body).status_code == 200
    bad = client.post("/api/auth/login", json={**body, "password": "wrong-password"})
    assert bad.status_code == 401


def test_validation_and_auth_required(client):
    assert client.post("/api/auth/register", json={"email": "nope", "password": "correct-horse-1"}).status_code == 422
    assert client.post("/api/auth/register", json={"email": "a@b.co", "password": "short"}).status_code == 422
    assert client.get("/api/jobs").status_code == 401
    assert client.get("/api/jobs", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_profile_extracts_skills(client, auth):
    profile = client.get("/api/profile", headers=auth).json()
    assert profile["ready"] and {"react", "node.js", "docker"} <= set(profile["skills"])


def test_jobs_are_ranked_by_match(client, auth):
    data = client.get("/api/jobs", headers=auth).json()
    scores = [j["score"] for j in data["items"]]
    assert data["total"] >= 12 and scores == sorted(scores, reverse=True)
    assert "Node" in data["items"][0]["title"] or "React" in data["items"][0]["title"]  # a full stack job leads


def test_search_and_filters(client, auth):
    hits = client.get("/api/jobs", headers=auth, params={"q": "kubernetes", "remote": True}).json()
    assert hits["total"] >= 1 and all(j["remote"] for j in hits["items"])
    assert client.get("/api/jobs", headers=auth, params={"min_score": 100}).json()["total"] == 0


def test_application_board_flow_and_isolation(client, auth):
    job_id = client.get("/api/jobs", headers=auth).json()["items"][0]["id"]
    created = client.post("/api/applications", headers=auth, json={"job_id": job_id})
    assert created.status_code == 201 and created.json()["status"] == "saved"
    assert client.post("/api/applications", headers=auth, json={"job_id": job_id}).status_code == 409

    app_id = created.json()["id"]
    moved = client.patch(f"/api/applications/{app_id}", headers=auth, json={"status": "applied", "notes": "sent resume"}).json()
    assert moved["status"] == "applied" and moved["applied_at"] and moved["notes"] == "sent resume"
    assert client.patch(f"/api/applications/{app_id}", headers=auth, json={"status": "bogus"}).status_code == 422

    # a different account must not see or touch it
    other = client.post("/api/auth/register", json={"email": "other@example.com", "password": "correct-horse-1"}).json()["token"]
    other_h = {"Authorization": f"Bearer {other}"}
    assert client.get("/api/applications", headers=other_h).json() == []
    assert client.patch(f"/api/applications/{app_id}", headers=other_h, json={"status": "offer"}).status_code == 404
    assert client.delete(f"/api/applications/{app_id}", headers=other_h).status_code == 404

    assert client.delete(f"/api/applications/{app_id}", headers=auth).status_code == 204


def test_analysis_falls_back_without_a_key_and_is_cached(client, auth):
    job_id = client.get("/api/jobs", headers=auth).json()["items"][0]["id"]
    first = client.post("/api/ai/analyze", headers=auth, json={"job_id": job_id})
    assert first.status_code == 200
    data = first.json()
    assert data["source"] == "heuristic" and data["summary"] and data["strengths"]
    assert client.post("/api/ai/analyze", headers=auth, json={"job_id": job_id}).json() == data


def test_analysis_needs_a_resume(client):
    token = client.post("/api/auth/register", json={"email": "empty@example.com", "password": "correct-horse-1"}).json()["token"]
    res = client.post("/api/ai/analyze", headers={"Authorization": f"Bearer {token}"}, json={"job_id": 1})
    assert res.status_code == 422


def test_cover_letter_streams_and_finishes(client, auth):
    job_id = client.get("/api/jobs", headers=auth).json()["items"][0]["id"]
    with client.stream("POST", "/api/ai/cover-letter", headers=auth, json={"job_id": job_id, "tone": "friendly"}) as res:
        assert res.status_code == 200 and res.headers["content-type"].startswith("text/event-stream")
        lines = [ln for ln in res.iter_lines() if ln.startswith("data: ")]
    assert lines[-1] == "data: [DONE]"
    text = "".join(json.loads(ln[6:])["t"] for ln in lines[:-1])
    assert "Dear" in text and len(lines) > 3  # arrived in several pieces, not one blob


def test_manual_job_is_scored(client, auth):
    res = client.post(
        "/api/jobs", headers=auth,
        json={"title": "React Developer", "company": "Me Inc", "description": "React, Node.js and Docker role."},
    )
    assert res.status_code == 201 and res.json()["score"] > 30 and "react" in res.json()["skills"]


def test_refresh_searches_for_the_users_roles_and_reports_skipped_providers(client, auth, monkeypatch):
    from app import ingest
    from app.routers import jobs as jobs_router

    seen = {}

    def fake_fetch_all(queries, location):
        seen.update(queries=queries, location=location)
        job = {"source": "adzuna", "external_id": "t-1", "title": "Python Developer", "company": "Acme", "location": "Pune",
               "remote": False, "url": "https://example.org/j/1", "salary": None, "description": "Python and FastAPI work.",
               "tags": [], "posted_at": None}
        return [job], {"jooble": "HTTP 500"}, ["adzuna-not-really"]

    monkeypatch.setattr(ingest, "fetch_all", fake_fetch_all)
    monkeypatch.setattr(jobs_router, "_last_refresh", 0.0)
    client.put("/api/profile", headers=auth, json={"resume_text": "Python developer.", "roles": "python developer, QA", "location": "Pune"})

    res = client.post("/api/jobs/refresh", headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert body["fetched"] == 1 and body["added"] == 1 and body["errors"] == {"jooble": "HTTP 500"} and body["skipped"] == ["adzuna-not-really"]
    assert seen["queries"][:2] == ["python developer", "QA"] and seen["location"] == "Pune"
    assert client.post("/api/jobs/refresh", headers=auth).status_code == 429  # the cooldown still protects the providers
    assert client.get("/api/jobs", headers=auth, params={"source": "adzuna"}).json()["total"] == 1
    with SessionLocal() as db:  # leave the shared test database as it was
        db.execute(delete(Job).where(Job.external_id == "t-1"))
        db.commit()


def test_demo_jobs_step_aside_once_real_jobs_exist(client, auth, fetched_jobs):
    def sources(**params):
        items = client.get("/api/jobs", headers=auth, params={"limit": 100, **params}).json()["items"]
        return {j["source"] for j in items}

    assert "demo" not in sources()
    assert client.get("/api/jobs", headers=auth).json()["demo_available"] is True  # so the screen can offer the switch
    assert "demo" in sources(demo=True)
    assert sources(source="demo") == {"demo"}  # picking the demo source is an explicit request
    visible = client.get("/api/jobs", headers=auth, params={"limit": 1}).json()["total"]
    with_demo = client.get("/api/jobs", headers=auth, params={"limit": 1, "demo": True}).json()["total"]
    assert with_demo - visible == 12  # exactly the demo set is held back
    assert client.get("/api/stats", headers=auth).json()["total_jobs"] == visible  # and the dashboard agrees


def test_posted_within_filter(client, auth, fetched_jobs):
    def companies(days=None):
        params = {"q": "ZZ", **({"max_age_days": days} if days else {})}
        return {j["company"] for j in client.get("/api/jobs", headers=auth, params=params).json()["items"]}

    assert companies(7) == {"ZZ fresh Co"}
    assert companies(30) == {"ZZ fresh Co", "ZZ mid Co"}
    assert companies(365) == {"ZZ fresh Co", "ZZ mid Co", "ZZ old Co"}
    assert companies() == {"ZZ fresh Co", "ZZ mid Co", "ZZ old Co"}  # no filter, no limit on age


def test_newer_jobs_rank_first_without_changing_the_shown_score(client, auth, fetched_jobs):
    items = client.get("/api/jobs", headers=auth, params={"q": "ZZ"}).json()["items"]
    assert [j["company"] for j in items] == ["ZZ fresh Co", "ZZ mid Co", "ZZ old Co"]
    assert len({j["score"] for j in items}) == 1  # same text, same score: only the order used the date


def test_job_apply_link_accepts_web_and_email_but_not_scripts(client, auth):
    def add(url):
        return client.post("/api/jobs", headers=auth, json={"title": "Dev", "company": "Acme", "url": url})

    assert add("https://acme.com/careers/1").status_code == 201
    assert add("mailto:hr@acme.com").status_code == 201
    assert add("").status_code == 201
    for bad in ("javascript:alert(1)", "data:text/html,x", "mailto:not-an-address", "mailto:a@b.co?cc=x@y.zz", "ftp://acme.com"):
        assert add(bad).status_code == 422, bad


def test_stats_shape(client, auth):
    job_id = client.get("/api/jobs", headers=auth).json()["items"][0]["id"]
    client.post("/api/applications", headers=auth, json={"job_id": job_id, "status": "applied"})
    stats = client.get("/api/stats", headers=auth).json()
    assert [f["status"] for f in stats["funnel"]] == ["saved", "applied", "interview", "offer", "rejected"]
    assert stats["tracked"] == 1 and len(stats["weekly"]) == 8 and stats["skill_gap"]
