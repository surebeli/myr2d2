from __future__ import annotations

import subprocess
from typing import Literal


PowerSource = Literal["ac", "battery", "unknown"]


def parse_pmset_batt(output: str) -> PowerSource:
    text = output.lower()
    if "ac power" in text:
        return "ac"
    if "battery power" in text:
        return "battery"
    return "unknown"


def get_power_source() -> PowerSource:
    try:
        proc = subprocess.run(["pmset", "-g", "batt"], check=False, capture_output=True, text=True)
        if proc.returncode != 0:
            return "unknown"
        return parse_pmset_batt(proc.stdout + "\n" + proc.stderr)
    except Exception:
        return "unknown"

