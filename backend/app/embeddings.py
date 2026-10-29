"""Turns text into a vector so a resume and a job can be compared with cosine similarity.

The default is a hashing vectorizer: word and word-pair counts hashed into 512 buckets. It needs no
download and no GPU, and it is deterministic, which keeps tests stable. For meaning-aware matching
("backend engineer" ~ "server-side developer") set EMBEDDING_BACKEND=sentence-transformers and
install sentence-transformers; the rest of the app does not change.
"""

import math
import os
import re
import zlib
from collections import Counter

DIM = 512
_TOKEN = re.compile(r"[a-z0-9+#.]+")
_STOP = frozenset(
    "a an and are as at be by for from has have in is it its of on or that the this to was we you your "
    "will with our their they them who what when where which about into over more most other such than "
    "then these those can also any all etc per using use used able work working team role job".split()
)

_model = None


def _tokens(text: str) -> list[str]:
    out = []
    for raw in _TOKEN.findall(text.lower()):
        tok = raw.strip(".")
        if len(tok) > 1 and tok not in _STOP:
            out.append(tok)
    return out


def _hash_embed(text: str) -> list[float]:
    toks = _tokens(text[:20000])
    counts = Counter(toks + [f"{a} {b}" for a, b in zip(toks, toks[1:])])
    vec = [0.0] * DIM
    for feature, n in counts.items():
        h = zlib.crc32(feature.encode())
        sign = 1.0 if (h >> 16) & 1 else -1.0  # signed hashing cancels most collision bias
        vec[h % DIM] += sign * (1.0 + math.log(n))
    return _normalize(vec)


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    return [round(v / norm, 5) for v in vec] if norm else vec


def _st_embed(text: str) -> list[float]:
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer  # optional dependency

        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _normalize([float(v) for v in _model.encode(text[:5000])])


def embed(text: str) -> list[float]:
    if os.getenv("EMBEDDING_BACKEND") == "sentence-transformers":
        return _st_embed(text)
    return _hash_embed(text)


def cosine(a: list[float], b: list[float]) -> float:
    """Both vectors are unit length, so the dot product is the cosine. Never below 0."""
    if not a or not b or len(a) != len(b):
        return 0.0
    return max(0.0, sum(x * y for x, y in zip(a, b)))
