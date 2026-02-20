#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NANOBOT_DIR="$ROOT_DIR/thirdparty/mynanobot"
VENV_DIR="$NANOBOT_DIR/.venv-bench"
BENCH_HOME_DIR="$NANOBOT_DIR/.bench-home"
BENCH_CACHE_DIR="$NANOBOT_DIR/.bench-pip-cache"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [--clean-only]

Rebuilds the isolated nanobot benchmark environment under:
  - $VENV_DIR
  - $BENCH_HOME_DIR
  - $BENCH_CACHE_DIR

Options:
  --clean-only   Remove the isolated benchmark directories and exit
  -h, --help     Show this help
USAGE
}

mode="rebuild"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean-only)
      mode="clean"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$NANOBOT_DIR" ]]; then
  echo "ERROR: nanobot directory not found: $NANOBOT_DIR" >&2
  exit 1
fi

rm -rf "$VENV_DIR" "$BENCH_HOME_DIR" "$BENCH_CACHE_DIR"

if [[ "$mode" == "clean" ]]; then
  echo "Cleaned benchmark-isolated nanobot directories."
  exit 0
fi

python3 -m venv "$VENV_DIR"
mkdir -p "$BENCH_HOME_DIR" "$BENCH_CACHE_DIR"

HOME="$BENCH_HOME_DIR" \
PIP_CACHE_DIR="$BENCH_CACHE_DIR" \
"$VENV_DIR/bin/python" -m pip install --isolated --disable-pip-version-check -e "$NANOBOT_DIR"

echo "Rebuilt nanobot benchmark environment."
echo "Use in benchmark manifest command:"
echo "  HOME=\"\$PWD/.bench-home\" .venv-bench/bin/python -m nanobot --help"
