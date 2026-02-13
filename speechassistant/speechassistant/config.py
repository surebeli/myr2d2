from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class ListeningConfig(BaseModel):
    sampleRate: int = 16000
    frameMs: int = 30
    vadAggressiveness: int = 2
    minSpeechMs: int = 400
    silenceMsToEnd: int = 650
    armedTimeoutMs: int = 8000


class WhisperConfig(BaseModel):
    engine: Literal["whisper", "whisper-cli"] = "whisper"
    language: str = "zh"
    acModel: str = "large-v3"
    batteryModel: str = "small"
    whisperCommand: str = "whisper"
    whisperExtraArgs: list[str] = Field(default_factory=lambda: ["--task", "transcribe", "--output_format", "txt", "--fp16", "False"])
    whisperCliCommand: str = "whisper-cli"
    whisperCliModelPathAc: str = ""
    whisperCliModelPathBattery: str = ""
    whisperCliExtraArgs: list[str] = Field(default_factory=list)


class OpenClawConfig(BaseModel):
    command: str = "openclaw"
    mode: Literal["agent"] = "agent"
    sessionId: str = ""
    to: str = ""
    agent: str = ""
    thinking: str = ""
    deliver: bool = False


class ServerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 8765


class AppConfig(BaseModel):
    wakeWords: list[str] = Field(default_factory=lambda: ["小虾米"])
    replyText: str = "我在"
    powerMode: Literal["auto", "ac", "battery"] = "auto"
    listening: ListeningConfig = Field(default_factory=ListeningConfig)
    whisper: WhisperConfig = Field(default_factory=WhisperConfig)
    openclaw: OpenClawConfig = Field(default_factory=OpenClawConfig)
    server: ServerConfig = Field(default_factory=ServerConfig)


def default_config_path() -> Path:
    return Path(__file__).resolve().parents[1] / "config.json"


def load_config(path: Path | None = None) -> AppConfig:
    p = path or default_config_path()
    if not p.exists():
        cfg = AppConfig()
        save_config(cfg, p)
        return cfg
    data = json.loads(p.read_text("utf-8"))
    return AppConfig.model_validate(data)


def save_config(cfg: AppConfig, path: Path | None = None) -> None:
    p = path or default_config_path()
    p.write_text(json.dumps(cfg.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n", "utf-8")

