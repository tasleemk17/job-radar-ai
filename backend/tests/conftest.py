import os
import tempfile

# Must be set before the app is imported: a throwaway database, no scheduler, no AI key
_dir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_dir}/test.db"
os.environ["ENABLE_SCHEDULER"] = "false"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["SEED_DEMO"] = "true"
# A developer's real keys in backend/.env must never make tests call the live APIs
for _name in ("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "JOOBLE_API_KEY"):
    os.environ[_name] = ""

import itertools  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

RESUME = (
    "Full stack developer. Built a food delivery platform with React, Node.js, Express, MongoDB, "
    "PostgreSQL, Docker, Kafka and AWS. Wrote tests with Jest and Playwright. Used Git and GitHub Actions."
)
_counter = itertools.count(1)


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # the context manager runs startup, which creates tables and seeds demo jobs
        yield c


@pytest.fixture()
def auth(client):
    """A fresh user with a saved resume, returned as request headers."""
    email = f"user{next(_counter)}@example.com"
    token = client.post("/api/auth/register", json={"email": email, "password": "correct-horse-1"}).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    res = client.put("/api/profile", headers=headers, json={"resume_text": RESUME, "roles": "full stack developer"})
    assert res.status_code == 200
    return headers
