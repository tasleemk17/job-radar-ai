import time
from collections import defaultdict, deque

from fastapi import HTTPException

from .config import AI_CALLS_PER_HOUR

_calls: dict[int, deque] = defaultdict(deque)


def check_ai_limit(user_id: int) -> None:
    """Each AI call can cost money, so one account may only make so many per hour."""
    now = time.time()
    window = _calls[user_id]
    while window and now - window[0] > 3600:
        window.popleft()
    if len(window) >= AI_CALLS_PER_HOUR:
        raise HTTPException(429, f"AI limit reached ({AI_CALLS_PER_HOUR} per hour). Try again later.")
    window.append(now)
