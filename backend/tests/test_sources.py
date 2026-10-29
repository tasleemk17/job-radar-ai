import httpx

from app import config, sources
from app.sources import build_queries, parse_adzuna, parse_arbeitnow, parse_jooble, parse_remotive


def test_remotive_parsing_strips_html_and_skips_bad_rows():
    jobs = parse_remotive(
        {
            "jobs": [
                {
                    "id": 7, "title": " Python Dev ", "company_name": "Acme", "url": "https://remotive.com/x",
                    "description": "<p>Build <b>APIs</b> &amp; more</p>", "tags": ["python", 5],
                    "candidate_required_location": "Worldwide", "salary": "", "publication_date": "2026-10-01T10:00:00",
                },
                {"id": None, "title": "No id"},
            ]
        }
    )
    assert len(jobs) == 1
    job = jobs[0]
    assert job["title"] == "Python Dev" and job["remote"] is True and job["salary"] is None
    assert job["description"] == "Build APIs & more"
    assert job["tags"] == ["python"]
    assert job["posted_at"].year == 2026


def test_arbeitnow_parsing_handles_epoch_dates():
    jobs = parse_arbeitnow(
        {"data": [{"slug": "dev-berlin", "title": "Dev", "company_name": "B", "remote": False, "created_at": 1760000000, "tags": []}]}
    )
    assert jobs[0]["external_id"] == "dev-berlin" and jobs[0]["remote"] is False
    assert jobs[0]["posted_at"].year == 2025


ADZUNA_SAMPLE = {
    "results": [
        {
            "id": "4711", "title": "<strong>Python</strong> Developer (Remote)", "redirect_url": "https://www.adzuna.in/land/ad/4711",
            "company": {"display_name": "Acme Pvt Ltd"}, "location": {"display_name": "Pune, Maharashtra", "area": ["India", "Pune"]},
            "description": "Build <b>APIs</b> with FastAPI &amp; Postgres...", "salary_min": 600000, "salary_max": 900000,
            "salary_is_predicted": "0", "created": "2026-10-20T08:15:00Z", "contract_time": "full_time",
            "category": {"label": "IT Jobs", "tag": "it-jobs"},
        },
        {"id": "4712", "title": "Guess", "redirect_url": "https://www.adzuna.in/land/ad/4712", "salary_min": 1, "salary_max": 5, "salary_is_predicted": "1"},
        {"id": "4713", "title": "No link"},
    ]
}


def test_adzuna_parsing():
    jobs = parse_adzuna(ADZUNA_SAMPLE, "in")
    assert len(jobs) == 2  # the row without a link is dropped
    job = jobs[0]
    assert job["source"] == "adzuna" and job["external_id"] == "4711"
    assert job["title"] == "Python Developer (Remote)"  # the <strong> highlight tags are gone
    assert job["company"] == "Acme Pvt Ltd" and job["location"] == "Pune, Maharashtra"
    assert job["remote"] is True  # read from the title, Adzuna has no flag
    assert job["salary"] == "INR 600,000 - 900,000 / year"
    assert job["description"] == "Build APIs with FastAPI & Postgres..."
    assert job["posted_at"].year == 2026 and job["tags"] == ["IT Jobs", "full_time"]
    assert jobs[1]["salary"] is None and jobs[1]["company"] == "Unknown"  # a predicted salary is not shown


def test_jooble_parsing_with_and_without_ids():
    jobs = parse_jooble(
        {
            "totalCount": 2,
            "jobs": [
                {"id": 123456789, "title": "<b>React</b> Developer", "location": "Nagpur", "snippet": "Work from home friendly &amp; fun",
                 "salary": "5 LPA", "source": "naukri-like.example", "type": "Full-time", "link": "https://jooble.org/desc/123", "company": "Pixel", "updated": "2026-10-21T00:00:00.0000000"},
                {"title": "QA Engineer", "link": "https://jooble.org/desc/999", "source": "somesite.example"},
                {"title": "No link here"},
            ],
        }
    )
    assert len(jobs) == 2
    first, second = jobs
    assert first["external_id"] == "123456789" and first["title"] == "React Developer" and first["remote"] is True
    assert first["salary"] == "5 LPA" and first["posted_at"].year == 2026 and first["tags"] == ["Full-time"]
    assert len(second["external_id"]) == 20 and second["company"] == "somesite.example"
    assert parse_jooble({"jobs": [{"title": "QA Engineer", "link": "https://jooble.org/desc/999"}]})[0]["external_id"] == second["external_id"]  # stable


def _fake_json(calls):
    """Stands in for the network: records each call and answers per provider."""

    def fake(method, url, **kwargs):
        calls.append((method, url, kwargs))
        if "remotive" in url:
            return {"jobs": []}
        if "arbeitnow" in url:
            return {"data": []}
        if "adzuna" in url:
            return ADZUNA_SAMPLE
        return {"jobs": [{"title": "Dev", "link": "https://jooble.org/desc/1", "company": "X"}]}

    return fake


def test_keyless_providers_are_skipped_not_errors(monkeypatch):
    calls = []
    monkeypatch.setattr(sources, "_json", _fake_json(calls))
    monkeypatch.setattr(config, "ADZUNA_APP_ID", "")
    monkeypatch.setattr(config, "JOOBLE_API_KEY", "")
    jobs, errors, skipped = sources.fetch_all(["python developer"], "Pune")
    assert skipped == ["adzuna", "jooble"] and errors == {}
    assert all("adzuna" not in c[1] and "jooble" not in c[1] for c in calls)


def test_adzuna_and_jooble_are_called_once_per_query_when_keys_are_set(monkeypatch):
    calls = []
    monkeypatch.setattr(sources, "_json", _fake_json(calls))
    monkeypatch.setattr(config, "ADZUNA_APP_ID", "id1")
    monkeypatch.setattr(config, "ADZUNA_APP_KEY", "key1")
    monkeypatch.setattr(config, "ADZUNA_COUNTRY", "in")
    monkeypatch.setattr(config, "JOOBLE_API_KEY", "jkey")
    jobs, errors, skipped = sources.fetch_all(["python developer", "react developer"], "Pune")
    assert skipped == [] and errors == {}
    adz = [c for c in calls if "adzuna" in c[1]]
    joo = [c for c in calls if "jooble" in c[1]]
    assert len(adz) == 2 and len(joo) == 2
    assert "/jobs/in/search/1" in adz[0][1] and adz[0][2]["params"]["what"] == "python developer" and adz[0][2]["params"]["where"] == "Pune"
    # the city is not sent to Jooble: it only understands the country (see fetch_jooble)
    assert joo[0][0] == "POST" and joo[0][1].endswith("/api/jkey") and joo[0][2]["json"] == {"keywords": "python developer", "location": "India", "page": 1}
    assert {j["source"] for j in jobs} == {"adzuna", "jooble"}


def test_adzuna_reads_several_pages_and_stops_at_a_short_page(monkeypatch):
    calls = []

    def fake(method, url, **kwargs):
        calls.append(url)
        page = int(url.rsplit("/", 1)[1])
        size = 50 if page < 3 else 7  # pages 1 and 2 are full, page 3 is the last and short
        return {"results": [{"id": f"p{page}-{i}", "title": "Dev", "redirect_url": "https://www.adzuna.in/x"} for i in range(size)]}

    monkeypatch.setattr(sources, "_json", fake)
    monkeypatch.setattr(config, "ADZUNA_PAGES", 5)
    jobs = sources.fetch_adzuna(["dev"], None)
    assert [u.rsplit("/", 1)[1] for u in calls] == ["1", "2", "3"]  # stopped at the short page, never asked for 4
    assert len(jobs) == 107 and len({j["external_id"] for j in jobs}) == 107

    calls.clear()
    monkeypatch.setattr(config, "ADZUNA_PAGES", 2)
    sources.fetch_adzuna(["dev"], None)
    assert len(calls) == 2  # the configured cap wins


def test_jooble_reads_several_pages_and_stops_at_a_short_page(monkeypatch):
    sent = []

    def fake(method, url, **kwargs):
        page = kwargs["json"]["page"]
        sent.append((kwargs["json"]["location"], page))
        size = 20 if page < 3 else 4  # pages 1 and 2 are full, page 3 is the last
        return {"jobs": [{"title": "Dev", "link": f"https://jooble.org/desc/{page}-{i}", "company": "X"} for i in range(size)]}

    monkeypatch.setattr(sources, "_json", fake)
    monkeypatch.setattr(config, "JOOBLE_API_KEY", "jkey")
    monkeypatch.setattr(config, "JOOBLE_PAGES", 5)
    monkeypatch.setattr(config, "JOOBLE_LOCATION", "India")
    jobs = sources.fetch_jooble(["dev"], "Pune")
    assert sent == [("India", 1), ("India", 2), ("India", 3)]  # the country, never the city; stopped at the short page
    assert len(jobs) == 44

    sent.clear()
    monkeypatch.setattr(config, "JOOBLE_PAGES", 2)
    sources.fetch_jooble(["dev"], "Pune")
    assert len(sent) == 2  # the configured cap wins


def test_a_whole_country_is_not_sent_as_a_place(monkeypatch):
    calls = []
    monkeypatch.setattr(sources, "_json", _fake_json(calls))
    monkeypatch.setattr(config, "ADZUNA_APP_ID", "id1")
    monkeypatch.setattr(config, "ADZUNA_APP_KEY", "key1")
    sources.fetch_all(["dev"], "India")
    assert "where" not in [c for c in calls if "adzuna" in c[1]][0][2]["params"]


def test_one_provider_failing_does_not_stop_the_others_and_never_leaks_keys(monkeypatch):
    def fake(method, url, **kwargs):
        if "adzuna" in url:
            raise httpx.ConnectError(f"failed to connect to {url}?app_key=SECRET-KEY-123")
        if "jooble" in url:
            raise ValueError(f"bad json from {url}")
        return {"jobs": [], "data": []}

    monkeypatch.setattr(sources, "_json", fake)
    monkeypatch.setattr(config, "ADZUNA_APP_ID", "id1")
    monkeypatch.setattr(config, "ADZUNA_APP_KEY", "SECRET-KEY-123")
    monkeypatch.setattr(config, "JOOBLE_API_KEY", "SECRET-JOOBLE-456")
    jobs, errors, skipped = sources.fetch_all(["dev"], None)
    assert set(errors) == {"adzuna", "jooble"}
    shown = " ".join(errors.values())
    assert "SECRET" not in shown and "http" not in shown  # no key, no URL
    assert errors["adzuna"] == "network error" and errors["jooble"] == "unexpected response"


def test_http_errors_show_only_the_status(monkeypatch):
    def fake(method, url, **kwargs):
        if "adzuna" in url:
            request = httpx.Request("GET", url + "?app_key=SECRET")
            raise httpx.HTTPStatusError("boom " + str(request.url), request=request, response=httpx.Response(401, request=request))
        return {"jobs": [], "data": []}

    monkeypatch.setattr(sources, "_json", fake)
    monkeypatch.setattr(config, "ADZUNA_APP_ID", "id1")
    monkeypatch.setattr(config, "ADZUNA_APP_KEY", "SECRET")
    _, errors, _ = sources.fetch_all(["dev"], None)
    assert errors == {"adzuna": "HTTP 401"}


def test_build_queries_puts_wanted_roles_first_without_repeats(monkeypatch):
    monkeypatch.setattr(config, "JOB_QUERIES", ["software developer", "python developer", "react developer"])
    assert build_queries("Full Stack Developer, python developer; QA") == [
        "Full Stack Developer", "python developer", "QA", "software developer", "react developer",
    ]
    assert build_queries(None) == ["software developer", "python developer", "react developer"]
    many = ", ".join(f"role{i}" for i in range(20))
    assert len(build_queries(many)) == sources.MAX_QUERIES
