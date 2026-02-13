from __future__ import annotations

import queue
import threading
import time
import wave
from dataclasses import dataclass
from pathlib import Path


@dataclass
class AudioSegment:
    pcm_s16le: bytes
    sample_rate: int

    def write_wav(self, path: Path) -> None:
        with wave.open(str(path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(self.pcm_s16le)


class MicSegmenter:
    def __init__(
        self,
        sample_rate: int,
        frame_ms: int,
        vad_aggressiveness: int,
        min_speech_ms: int,
        silence_ms_to_end: int,
    ):
        self.sample_rate = int(sample_rate)
        self.frame_ms = int(frame_ms)
        self.vad_aggressiveness = int(vad_aggressiveness)
        self.min_speech_ms = int(min_speech_ms)
        self.silence_ms_to_end = int(silence_ms_to_end)

        self._q: queue.Queue[bytes] = queue.Queue()
        self._stop = threading.Event()
        self._stream = None

    def start(self) -> None:
        import sounddevice as sd
        import webrtcvad

        frame_samples = int(self.sample_rate * self.frame_ms / 1000)
        blocksize = frame_samples

        vad = webrtcvad.Vad(self.vad_aggressiveness)

        def callback(indata, frames, time_info, status):
            if self._stop.is_set():
                return
            b = bytes(indata)
            if len(b) == frames * 2:
                self._q.put(b)

        self._vad = vad
        self._frame_samples = frame_samples
        self._stream = sd.RawInputStream(
            samplerate=self.sample_rate,
            blocksize=blocksize,
            channels=1,
            dtype="int16",
            callback=callback,
        )
        self._stream.start()

    def stop(self) -> None:
        self._stop.set()
        if self._stream is not None:
            try:
                self._stream.stop()
            finally:
                self._stream.close()
        self._stream = None

    def segments(self):
        voiced: list[bytes] = []
        voiced_ms = 0
        silence_ms = 0
        last_activity = time.time()

        while not self._stop.is_set():
            try:
                frame = self._q.get(timeout=0.25)
            except queue.Empty:
                if voiced and (time.time() - last_activity) > 2.0:
                    voiced = []
                    voiced_ms = 0
                    silence_ms = 0
                continue

            last_activity = time.time()
            is_speech = bool(self._vad.is_speech(frame, self.sample_rate))
            if is_speech:
                voiced.append(frame)
                voiced_ms += self.frame_ms
                silence_ms = 0
                continue

            if not voiced:
                continue

            silence_ms += self.frame_ms
            voiced.append(frame)
            voiced_ms += self.frame_ms
            if silence_ms < self.silence_ms_to_end:
                continue

            if voiced_ms >= self.min_speech_ms:
                pcm = b"".join(voiced)
                yield AudioSegment(pcm_s16le=pcm, sample_rate=self.sample_rate)

            voiced = []
            voiced_ms = 0
            silence_ms = 0

