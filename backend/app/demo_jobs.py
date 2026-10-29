"""Sample jobs so the app is useful on the first run and without internet. They are clearly marked
source="demo" in the UI and link to example.com."""

from datetime import datetime, timedelta

from .models import utcnow


def _job(n, title, company, location, remote, salary, tags, description, days_ago):
    return {
        "source": "demo",
        "external_id": f"demo-{n}",
        "title": title,
        "company": company,
        "location": location,
        "remote": remote,
        "url": f"https://example.com/jobs/{n}",
        "salary": salary,
        "description": description,
        "tags": tags,
        "posted_at": utcnow() - timedelta(days=days_ago),
    }


DEMO_JOBS = [
    _job(1, "Frontend Developer (React)", "Pixel Works", "Pune, India", False, "6-10 LPA", ["react", "typescript"],
         "Build fast, accessible interfaces with React, TypeScript, Tailwind CSS and Redux. You will work with REST APIs, "
         "write unit tests with Jest, and use Git and GitHub Actions for CI/CD. Experience with Vite and Figma handoffs helps.", 1),
    _job(2, "Full Stack Engineer (Node.js + React)", "Cartly", "Remote (India)", True, "10-16 LPA", ["node.js", "react", "mongodb"],
         "Own features end to end: React on the front, Node.js and Express on the back, MongoDB and Redis for data. "
         "You will design REST APIs, add JWT auth, ship with Docker on AWS, and write tests with Jest and Playwright.", 2),
    _job(3, "Python Backend Engineer", "DataLoom", "Bengaluru, India", False, "12-20 LPA", ["python", "fastapi", "postgresql"],
         "Build services with Python and FastAPI on PostgreSQL. Strong SQL, SQLAlchemy, Docker and pytest. "
         "You will work with Kafka for events, Redis for caching, and deploy to Kubernetes on AWS. Microservices experience is a plus.", 1),
    _job(4, "AI Engineer (LLM Applications)", "Cortex Labs", "Remote", True, "18-30 LPA", ["llm", "python", "rag"],
         "Ship LLM features: retrieval augmented generation, embeddings and vector search with Postgres, prompt engineering, "
         "streaming responses and evaluation harnesses. Python, FastAPI, Docker and strong testing habits required. "
         "Experience with LangChain, OpenAI or Hugging Face is welcome.", 0),
    _job(5, "Java Spring Boot Developer", "FinServe", "Mumbai, India", False, "8-14 LPA", ["java", "spring boot"],
         "Develop banking microservices in Java with Spring Boot, PostgreSQL and Kafka. REST APIs, JUnit, Docker, Jenkins CI/CD "
         "and clean object oriented design. Knowledge of Kubernetes and AWS is a plus.", 3),
    _job(6, "DevOps Engineer", "CloudNest", "Hyderabad, India", False, "10-18 LPA", ["aws", "kubernetes", "terraform"],
         "Run our platform on AWS with Kubernetes and Terraform. Build CI/CD pipelines with GitHub Actions, monitor with Prometheus "
         "and Grafana, and automate with Bash, Python and Ansible. Strong Linux and Docker skills needed.", 4),
    _job(7, "QA Automation Engineer", "TestRight", "Remote (India)", True, "6-11 LPA", ["playwright", "selenium"],
         "Design automated tests with Playwright, Cypress and Selenium. Write API tests in Postman, run them in CI with Jenkins, "
         "and report in Jira. JavaScript or Python scripting, and a clear sense of end-to-end testing.", 2),
    _job(8, "Data Analyst", "InsightCo", "Gurugram, India", False, "5-9 LPA", ["sql", "tableau"],
         "Turn data into decisions with SQL, Python, pandas and Tableau or Power BI. Build dashboards, clean data, "
         "and explain results to non-technical teams. Microsoft Excel and basic statistics expected.", 5),
    _job(9, "Machine Learning Engineer", "VisionAI", "Bengaluru, India", False, "15-28 LPA", ["machine learning", "pytorch"],
         "Train and deploy machine learning and deep learning models with PyTorch, scikit-learn, pandas and numpy. "
         "NLP and embeddings experience valued. Docker, AWS, Airflow and solid Python engineering practice.", 6),
    _job(10, "Software Engineer (Backend, Node.js)", "Foodie", "Remote", True, "9-15 LPA", ["node.js", "microservices"],
         "Build order and delivery services in Node.js and TypeScript with PostgreSQL, Redis and Kafka. Design microservices, "
         "REST APIs and WebSockets, deploy with Docker and Kubernetes, and monitor with Datadog.", 1),
    _job(11, "Junior Web Developer", "BrightSites", "Nagpur, India", False, "3-5 LPA", ["html", "css", "javascript"],
         "Create responsive websites with HTML, CSS, JavaScript and Bootstrap. Basic React and Git knowledge, "
         "willingness to learn, and good communication. Freshers with strong projects are welcome.", 2),
    _job(12, "Platform Engineer (Python)", "Streamline", "Remote", True, "14-22 LPA", ["python", "docker", "aws"],
         "Build internal developer platforms in Python and Go on AWS. Docker, Kubernetes, Terraform, FastAPI, GitHub Actions "
         "and PostgreSQL. System design thinking and clear documentation are important.", 3),
]
