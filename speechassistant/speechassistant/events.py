from __future__ import annotations

import time
from typing import Any, Literal

from pydantic import BaseModel, Field


EventType = Literal["status", "transcript", "openclaw_response", "error", "log"]


class Event(BaseModel):
    type: EventType
    ts: float = Field(default_factory=lambda: time.time())
    data: dict[str, Any] = Field(default_factory=dict)

