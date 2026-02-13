from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Literal

from .config import AppConfig
from .power import PowerSource


Engine = Literal["whisper", "whisper-cli"]


def _select_profile(cfg: AppConfig, power: PowerSource) -> PowerSource:
    if cfg.powerMode == "ac":
        return "ac"
    if cfg.powerMode == "battery":
        return "battery"
    return power


def _read_text_file(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text("utf-8", errors="ignore").strip()


def transcribe_wav(wav_path: Path, cfg: AppConfig, power: PowerSource) -> tuple[str, dict]:
    profile = _select_profile(cfg, power)
    engine: Engine = cfg.whisper.engine

    if engine == "whisper-cli":
        model_path = cfg.whisper.whisperCliModelPathAc if profile == "ac" else cfg.whisper.whisperCliModelPathBattery
        if not model_path:
            model_path = os.environ.get("WHISPER_CPP_MODEL", "").strip()
        if not model_path:
            raise RuntimeError("whisper-cli selected but no model path configured")
        mp = Path(model_path).expanduser()
        if not mp.exists():
            raise RuntimeError(f"whisper-cli model not found: {mp}")

        with tempfile.TemporaryDirectory(prefix="speechassistant-") as tmp:
            out_base = Path(tmp) / "out"
            args = ["-m", str(mp), "-otxt", "-of", str(out_base), "-np", "-nt", str(wav_path)]
            if cfg.whisper.whisperCliExtraArgs:
                args = args[:-1] + cfg.whisper.whisperCliExtraArgs + [args[-1]]
            proc = subprocess.run(
                [cfg.whisper.whisperCliCommand, *args],
                check=False,
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0:
                raise RuntimeError((proc.stdout + "\n" + proc.stderr).strip())
            transcript = _read_text_file(out_base.with_suffix(".txt"))
            return transcript, {"engine": "whisper-cli", "profile": profile, "modelPath": str(mp)}

    model = cfg.whisper.acModel if profile == "ac" else cfg.whisper.batteryModel
    with tempfile.TemporaryDirectory(prefix="speechassistant-") as tmp:
        tmp_dir = Path(tmp)
        args = [
            str(wav_path),
            "--model",
            model,
            "--language",
            cfg.whisper.language,
            "--output_dir",
            str(tmp_dir),
            *cfg.whisper.whisperExtraArgs,
        ]
        proc = subprocess.run(
            [cfg.whisper.whisperCommand, *args],
            check=False,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError((proc.stdout + "\n" + proc.stderr).strip())
        out_txt = tmp_dir / (wav_path.stem + ".txt")
        transcript = _read_text_file(out_txt)
        return transcript, {"engine": "whisper", "profile": profile, "model": model}

