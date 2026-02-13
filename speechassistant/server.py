from __future__ import annotations

import asyncio
import json
import threading
import time
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from speechassistant.asr_whisper import transcribe_wav
from speechassistant.audio_capture import MicSegmenter
from speechassistant.config import AppConfig, load_config, save_config
from speechassistant.events import Event
from speechassistant.openclaw_client import run_openclaw_agent
from speechassistant.power import get_power_source
from speechassistant.wake_state import WakeStateMachine


class RuntimeState:
    def __init__(self) -> None:
        self.listening: bool = False
        self.power: str = "unknown"
        self.wakeState: str = "idle"
        self.lastTranscript: str = ""
        self.lastOpenClawRaw: str = ""
        self.lastOpenClawJson: Any = None
        self.lastError: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "listening": self.listening,
            "power": self.power,
            "wakeState": self.wakeState,
            "lastTranscript": self.lastTranscript,
            "lastOpenClawRaw": self.lastOpenClawRaw,
            "lastOpenClawJson": self.lastOpenClawJson,
            "lastError": self.lastError,
        }


class AppRuntime:
    def __init__(self, cfg_path: Path):
        self.cfg_path = cfg_path
        self.cfg: AppConfig = load_config(cfg_path)
        self.state = RuntimeState()
        self._stop = threading.Event()
        self._listen_stop = threading.Event()
        self._listen_thread: threading.Thread | None = None
        self._ws: set[WebSocket] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def emit(self, event: Event) -> None:
        dead: list[WebSocket] = []
        payload = event.model_dump(mode="json")
        for ws in list(self._ws):
            try:
                await ws.send_text(json.dumps(payload, ensure_ascii=False))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._ws.discard(ws)

    def emit_threadsafe(self, event: Event) -> None:
        if self._loop is None:
            return
        asyncio.run_coroutine_threadsafe(self.emit(event), self._loop)

    def save_cfg(self) -> None:
        save_config(self.cfg, self.cfg_path)

    def start_listening(self) -> None:
        if self._listen_thread and self._listen_thread.is_alive():
            return
        self._listen_stop = threading.Event()
        self._listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._listen_thread.start()

    def stop_listening(self) -> None:
        self._listen_stop.set()
        self.state.listening = False

    def _listen_loop(self) -> None:
        cfg = self.cfg
        self.state.listening = True
        self.emit_threadsafe(Event(type="status", data=self.state.to_dict()))

        wake = WakeStateMachine(cfg.wakeWords, cfg.listening.armedTimeoutMs)
        seg = MicSegmenter(
            sample_rate=cfg.listening.sampleRate,
            frame_ms=cfg.listening.frameMs,
            vad_aggressiveness=cfg.listening.vadAggressiveness,
            min_speech_ms=cfg.listening.minSpeechMs,
            silence_ms_to_end=cfg.listening.silenceMsToEnd,
        )

        try:
            seg.start()
        except Exception as e:
            self.state.lastError = str(e)
            self.state.listening = False
            self.emit_threadsafe(Event(type="error", data={"message": str(e)}))
            self.emit_threadsafe(Event(type="status", data=self.state.to_dict()))
            return

        try:
            for audio in seg.segments():
                if self._listen_stop.is_set():
                    break

                power = get_power_source()
                self.state.power = power
                now_ms = int(time.time() * 1000)
                tick = wake.tick(now_ms)
                if tick.type == "timeout":
                    self.state.wakeState = wake.state
                    self.emit_threadsafe(Event(type="status", data=self.state.to_dict()))

                with tempfile_wav(audio.sample_rate) as wav_path:
                    audio.write_wav(wav_path)
                    try:
                        transcript, meta = transcribe_wav(wav_path, cfg, power)
                    except Exception as e:
                        self.state.lastError = str(e)
                        self.emit_threadsafe(Event(type="error", data={"message": str(e)}))
                        continue

                transcript = (transcript or "").strip()
                if not transcript:
                    continue

                self.state.lastTranscript = transcript
                self.emit_threadsafe(Event(type="transcript", data={"text": transcript, "meta": meta}))

                decision = wake.feed_transcript(transcript, now_ms)
                self.state.wakeState = wake.state
                self.emit_threadsafe(Event(type="status", data=self.state.to_dict()))

                if decision.type == "woke":
                    self.emit_threadsafe(Event(type="log", data={"message": cfg.replyText}))
                    continue

                if decision.type == "command":
                    try:
                        resp = run_openclaw_agent(decision.text, cfg)
                        self.state.lastOpenClawRaw = resp.get("raw", "")
                        self.state.lastOpenClawJson = resp.get("json", None)
                        self.emit_threadsafe(
                            Event(
                                type="openclaw_response",
                                data={"command": decision.text, "raw": self.state.lastOpenClawRaw, "json": self.state.lastOpenClawJson},
                            )
                        )
                    except Exception as e:
                        self.state.lastError = str(e)
                        self.emit_threadsafe(Event(type="error", data={"message": str(e)}))
                    finally:
                        self.emit_threadsafe(Event(type="status", data=self.state.to_dict()))
        finally:
            try:
                seg.stop()
            finally:
                self.state.listening = False
                self.emit_threadsafe(Event(type="status", data=self.state.to_dict()))


class tempfile_wav:
    def __init__(self, sample_rate: int) -> None:
        self.sample_rate = sample_rate
        self.path: Path | None = None

    def __enter__(self) -> Path:
        import tempfile

        fd, name = tempfile.mkstemp(prefix="speechassistant-", suffix=".wav")
        Path(name).write_bytes(b"")
        self.path = Path(name)
        try:
            import os

            os.close(fd)
        except Exception:
            pass
        return self.path

    def __exit__(self, exc_type, exc, tb) -> None:
        if self.path and self.path.exists():
            try:
                self.path.unlink()
            except Exception:
                pass


cfg_path = Path(__file__).resolve().parent / "config.json"
rt = AppRuntime(cfg_path)
app = FastAPI()


@app.on_event("startup")
async def _startup() -> None:
    rt.attach_loop(asyncio.get_running_loop())
    rt.emit_threadsafe(Event(type="status", data=rt.state.to_dict()))


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/state")
async def state():
    return JSONResponse(rt.state.to_dict())


@app.get("/config")
async def get_config():
    return JSONResponse(rt.cfg.model_dump(mode="json"))


@app.post("/config")
async def set_config(body: dict[str, Any]):
    rt.cfg = AppConfig.model_validate(body)
    rt.save_cfg()
    rt.emit_threadsafe(Event(type="status", data=rt.state.to_dict()))
    return {"ok": True}


@app.post("/listening/start")
async def listening_start():
    rt.start_listening()
    return {"ok": True}


@app.post("/listening/stop")
async def listening_stop():
    rt.stop_listening()
    return {"ok": True}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    rt._ws.add(ws)
    await ws.send_text(json.dumps(Event(type="status", data=rt.state.to_dict()).model_dump(mode="json"), ensure_ascii=False))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        rt._ws.discard(ws)


def main() -> None:
    cfg = rt.cfg
    uvicorn.run(app, host=cfg.server.host, port=cfg.server.port, log_level="info")


if __name__ == "__main__":
    main()

