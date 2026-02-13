import os
import platform
import subprocess
import sys
from pathlib import Path


def run(argv: list[str], cwd: Path) -> None:
    proc = subprocess.run(argv, cwd=str(cwd), check=False)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def main() -> None:
    root = Path(__file__).resolve().parent
    venv_dir = root / ".venv"
    if not venv_dir.exists():
        run([sys.executable, "-m", "venv", str(venv_dir)], root)

    py = venv_dir / "bin" / "python3"
    pip = venv_dir / "bin" / "pip"
    if platform.system() == "Windows":
        py = venv_dir / "Scripts" / "python.exe"
        pip = venv_dir / "Scripts" / "pip.exe"

    run([str(py), "-m", "pip", "install", "--upgrade", "pip"], root)
    run([str(pip), "install", "-r", "requirements.txt"], root)

    sys.stdout.write("OK\n")
    sys.stdout.write(f"VENV={venv_dir}\n")
    sys.stdout.write("If sounddevice fails to import on macOS, install PortAudio: brew install portaudio\n")


if __name__ == "__main__":
    main()

