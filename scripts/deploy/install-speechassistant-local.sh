#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${MYR2D2_ROOT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"}"
DEPLOY_ROOT="${MYR2D2_DEPLOY_TARGET:-"${HOME}/.local/share/myr2d2"}"
SYNC="${MYR2D2_SYNC:-1}"

REPO_SA_DIR="${ROOT_DIR}/speechassistant"
DEPLOY_SA_ROOT="${DEPLOY_ROOT}/speechassistant"
DEPLOY_SA_RELEASES="${DEPLOY_SA_ROOT}/releases"
DEPLOY_SA_CURRENT="${DEPLOY_SA_ROOT}/current"
BIN_DIR="${HOME}/.local/bin"

mkdir -p "${BIN_DIR}"
mkdir -p "${DEPLOY_SA_RELEASES}"

pick_python() {
  if command -v python3.11 >/dev/null 2>&1; then
    echo "python3.11"
    return 0
  fi
  if [[ -x "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3" ]]; then
    echo "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3"
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY' >/dev/null 2>&1 || exit 2
import sys
assert sys.version_info >= (3, 10)
PY
    echo "python3"
    return 0
  fi
  return 2
}

PYTHON_BIN="$(pick_python || true)"
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "python >= 3.10 is required for speechassistant (try install python3.11)" >&2
  exit 2
fi

if [[ "${SYNC}" == "1" ]]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  GIT_SHA="$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo nogit)"
  RELEASE_DIR="${DEPLOY_SA_RELEASES}/${TS}-${GIT_SHA}"
  mkdir -p "${RELEASE_DIR}"
  rsync -a --delete "${REPO_SA_DIR}/" "${RELEASE_DIR}/"
  "${PYTHON_BIN}" "${RELEASE_DIR}/install.py"
  ln -sfn "${RELEASE_DIR}" "${DEPLOY_SA_CURRENT}"
else
  if [[ ! -e "${DEPLOY_SA_CURRENT}/server.py" ]]; then
    echo "speechassistant not deployed. Re-run with --sync" >&2
    exit 2
  fi
fi

WRAPPER="${BIN_DIR}/speechassistant-daemon"
cat > "${WRAPPER}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
SA_HOME="${DEPLOY_SA_CURRENT}"
exec "\${SA_HOME}/.venv/bin/python3" "\${SA_HOME}/server.py" "\$@"
EOF
chmod +x "${WRAPPER}"

echo "Installed wrapper: ${WRAPPER}"
