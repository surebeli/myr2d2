from __future__ import annotations

import json
import subprocess
from typing import Any

from .config import AppConfig


def _try_parse_json_tail(text: str) -> Any | None:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for i in range(len(lines) - 1, -1, -1):
        s = lines[i]
        if not (s.startswith("{") and s.endswith("}")):
            continue
        try:
            return json.loads(s)
        except Exception:
            continue
    try:
        return json.loads(text)
    except Exception:
        return None


def run_openclaw_agent(message: str, cfg: AppConfig) -> dict[str, Any]:
    args: list[str] = ["agent", "--message", message, "--json"]
    if cfg.openclaw.to:
        args += ["--to", cfg.openclaw.to]
    if cfg.openclaw.sessionId:
        args += ["--session-id", cfg.openclaw.sessionId]
    if cfg.openclaw.agent:
        args += ["--agent", cfg.openclaw.agent]
    if cfg.openclaw.thinking:
        args += ["--thinking", cfg.openclaw.thinking]
    if cfg.openclaw.deliver:
        args += ["--deliver"]

    proc = subprocess.run(
        [cfg.openclaw.command, *args],
        check=False,
        capture_output=True,
        text=True,
    )
    out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    parsed = _try_parse_json_tail(out)
    if proc.returncode != 0:
        raise RuntimeError(out.strip() or f"openclaw exited with {proc.returncode}")
    return {"raw": out, "json": parsed}

