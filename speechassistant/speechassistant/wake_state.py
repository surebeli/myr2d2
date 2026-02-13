from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


State = Literal["idle", "armed"]


@dataclass
class WakeDecision:
    type: Literal["none", "woke", "command", "timeout"]
    text: str = ""


class WakeStateMachine:
    def __init__(self, wake_words: list[str], armed_timeout_ms: int):
        self._wake_words = [w for w in wake_words if isinstance(w, str) and w.strip()]
        self._armed_timeout_ms = max(500, int(armed_timeout_ms))
        self._state: State = "idle"
        self._armed_deadline_ms: int = 0

    @property
    def state(self) -> State:
        return self._state

    def _contains_wake(self, text: str) -> bool:
        t = text.strip()
        if not t:
            return False
        return any(w in t for w in self._wake_words)

    def tick(self, now_ms: int) -> WakeDecision:
        if self._state == "armed" and now_ms >= self._armed_deadline_ms:
            self._state = "idle"
            self._armed_deadline_ms = 0
            return WakeDecision(type="timeout")
        return WakeDecision(type="none")

    def feed_transcript(self, text: str, now_ms: int) -> WakeDecision:
        t = (text or "").strip()
        if not t:
            return WakeDecision(type="none")

        if self._state == "idle":
            if self._contains_wake(t):
                self._state = "armed"
                self._armed_deadline_ms = now_ms + self._armed_timeout_ms
                return WakeDecision(type="woke", text=t)
            return WakeDecision(type="none")

        if self._contains_wake(t):
            self._armed_deadline_ms = now_ms + self._armed_timeout_ms
            return WakeDecision(type="none")

        self._state = "idle"
        self._armed_deadline_ms = 0
        return WakeDecision(type="command", text=t)

