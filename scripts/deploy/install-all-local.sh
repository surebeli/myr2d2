#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

SYNC=1
TARGET_DIR="${HOME}/.local/share/myr2d2"

usage() {
  cat <<EOF
Usage: bash scripts/deploy/install-all-local.sh [--sync|--no-sync] [--target <dir>]

Options:
  --sync       Sync latest repo source into deployment target (default)
  --no-sync    Do not sync; keep using current deployed copy
  --target     Deployment root (default: ~/.local/share/myr2d2)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync)
      SYNC=1
      shift
      ;;
    --no-sync)
      SYNC=0
      shift
      ;;
    --target)
      TARGET_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

export MYR2D2_ROOT_DIR="${ROOT_DIR}"
export MYR2D2_DEPLOY_TARGET="${TARGET_DIR}"
export MYR2D2_SYNC="${SYNC}"

bash "${ROOT_DIR}/scripts/deploy/install-openclaw-local.sh"
bash "${ROOT_DIR}/scripts/deploy/install-speechassistant-local.sh"

echo "Done"
