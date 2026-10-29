from datetime import datetime, timedelta

from app.embeddings import cosine, embed
from app.matching import freshness_bonus, score
from app.models import Job, Profile
from app.skills import extract_skills


def test_skills_found_with_odd_spellings():
    found = extract_skills("We use C++, C#, Node.js and .NET, plus React Native. Java but not JavaScript? Both.")
    assert {"c++", "c#", "node.js", ".net", "react native", "java", "javascript"} <= set(found)


def test_skills_do_not_match_inside_other_words():
    assert "java" not in extract_skills("Strong JavaScript skills")
    assert "rest api" not in extract_skills("the rest of the team")
    assert "express.js" not in extract_skills("express interest in the role")


def test_embedding_is_unit_length_and_deterministic():
    a, b = embed("react node developer"), embed("react node developer")
    assert a == b
    assert abs(sum(x * x for x in a) - 1) < 1e-3


def test_similar_text_scores_higher_than_unrelated_text():
    base = embed("react typescript frontend developer building web interfaces")
    close = embed("frontend developer with react and typescript for web interfaces")
    far = embed("registered nurse caring for patients in a hospital ward")
    assert cosine(base, close) > cosine(base, far) + 0.2


def _profile(resume: str, roles: str = "") -> Profile:
    return Profile(user_id=1, resume_text=resume, roles=roles, skills=extract_skills(resume), embedding=embed(resume))


def _job(title: str, description: str) -> Job:
    text = f"{title}. {description}"
    return Job(title=title, company="X", description=description, skills=extract_skills(text), embedding=embed(text))


def test_good_match_beats_bad_match_and_lists_gaps():
    me = _profile("React developer. Used TypeScript, Redux, Jest and Git for web apps.", "frontend developer")
    good = _job("Frontend Developer", "React, TypeScript, Redux and Jest for web apps. Docker is a plus.")
    bad = _job("Data Engineer", "Spark, Airflow, Kafka and Scala pipelines on AWS.")
    a, b = score(me, good), score(me, bad)
    assert a.score > b.score + 25
    assert {"react", "typescript"} <= set(a.matched)
    assert "docker" in a.missing


def test_one_lucky_skill_does_not_make_a_strong_match():
    me = _profile("Full stack developer with React, Node.js, Docker and AWS projects.", "full stack developer")
    thin = _job("Sales Engineering Manager", "Lead a sales team. Cloud knowledge such as AWS is useful.")
    real = _job("Full Stack Developer", "React, Node.js, Docker and AWS for our web platform.")
    assert score(me, thin).score < 45
    assert score(me, real).score > score(me, thin).score + 30


def test_freshness_bonus_fades_with_age():
    now = datetime(2026, 10, 29, 12, 0)
    assert freshness_bonus(now, now) == 8.0
    assert 3.9 < freshness_bonus(now - timedelta(days=15), now) < 4.1
    assert freshness_bonus(now - timedelta(days=45), now) == 0.0
    assert freshness_bonus(None, now) == 0.0  # an unknown date neither helps nor hurts
    assert freshness_bonus(now + timedelta(days=2), now) == 8.0  # a date in the future is clamped, not rewarded more


def test_no_resume_means_no_score():
    assert score(Profile(user_id=1, resume_text="  "), _job("Dev", "python")) is None
    assert score(None, _job("Dev", "python")) is None
