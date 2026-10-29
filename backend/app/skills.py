"""Finds known skills in free text. A fixed vocabulary is predictable and free, unlike asking an LLM."""

import re

# canonical name | alias | alias ...
_VOCAB = """
python|py3 ; javascript|js|es6 ; typescript ; java ; c++|cpp ; c#|csharp ; golang|go language ; rust ; php ; ruby ; kotlin ; swift ; scala ; sql ; bash|shell scripting
react|reactjs|react.js ; react native ; next.js|nextjs ; vue|vuejs|vue.js ; angular ; svelte ; redux ; html|html5 ; css|css3 ; tailwind|tailwindcss ; sass|scss ; bootstrap ; webpack ; vite ; jquery
node.js|nodejs|node js ; express.js|expressjs|express js ; nestjs ; fastapi ; flask ; django ; spring boot|springboot|spring framework ; .net|dotnet|asp.net ; laravel ; rails|ruby on rails ; graphql ; rest api|restful|restful apis|rest apis ; grpc ; websockets|websocket ; microservices
postgresql|postgres ; mysql ; mongodb|mongo ; redis ; sqlite ; elasticsearch ; dynamodb ; cassandra ; kafka ; rabbitmq ; supabase ; firebase ; prisma ; sqlalchemy
docker ; kubernetes|k8s ; terraform ; ansible ; aws|amazon web services ; azure ; gcp|google cloud ; linux ; nginx ; ci/cd|cicd|continuous integration ; github actions ; jenkins ; gitlab ci ; git ; prometheus ; grafana ; datadog
machine learning|ml ; deep learning ; nlp|natural language processing ; llm|llms|large language models ; rag|retrieval augmented generation ; prompt engineering ; embeddings|vector search ; pytorch ; tensorflow ; scikit-learn|sklearn ; pandas ; numpy ; apache spark|pyspark ; airflow ; dbt ; tableau ; power bi|powerbi ; microsoft excel|ms excel ; langchain ; openai ; hugging face|huggingface
jest ; pytest ; junit ; cypress ; playwright ; selenium ; postman ; tdd|test driven development ; unit testing ; e2e testing|end-to-end testing
agile ; scrum ; jira ; figma ; oauth ; jwt ; system design ; data structures ; algorithms ; oop|object oriented
"""


def _build() -> dict[str, re.Pattern]:
    table = {}
    for entry in _VOCAB.replace("\n", ";").split(";"):
        names = [n.strip() for n in entry.split("|") if n.strip()]
        if not names:
            continue
        alternatives = "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))
        # not glued to other letters/digits, so "java" does not match inside "javascript"
        table[names[0]] = re.compile(rf"(?<![a-z0-9+#.]){'(?:' + alternatives + ')'}(?![a-z0-9+#])")
    return table


_PATTERNS = _build()


def extract_skills(text: str) -> list[str]:
    lowered = text.lower()
    return sorted(name for name, pattern in _PATTERNS.items() if pattern.search(lowered))
