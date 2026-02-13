#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${MYR2D2_ROOT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"}"
DEPLOY_ROOT="${MYR2D2_DEPLOY_TARGET:-"${HOME}/.local/share/myr2d2"}"
SYNC="${MYR2D2_SYNC:-1}"

REPO_OC_DIR="${ROOT_DIR}/thirdparty/myopenclaw"
DEPLOY_OC_ROOT="${DEPLOY_ROOT}/openclaw"
DEPLOY_OC_RELEASES="${DEPLOY_OC_ROOT}/releases"
DEPLOY_OC_CURRENT="${DEPLOY_OC_ROOT}/current"
BIN_DIR="${HOME}/.local/bin"

mkdir -p "${BIN_DIR}"
mkdir -p "${DEPLOY_OC_RELEASES}"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required" >&2
  exit 2
fi

export PATH="${ROOT_DIR}/scripts/build/bin:${PATH}"

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
    return
  fi
  if command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
    return
  fi
  echo "pnpm/corepack not found" >&2
  return 2
}

if [[ "${SYNC}" == "1" ]]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  GIT_SHA="$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo nogit)"
  RELEASE_DIR="${DEPLOY_OC_RELEASES}/${TS}-${GIT_SHA}"
  mkdir -p "${RELEASE_DIR}"
  rsync -a --delete "${REPO_OC_DIR}/" "${RELEASE_DIR}/"
  run_pnpm -C "${RELEASE_DIR}" install
  run_pnpm -C "${RELEASE_DIR}" build
  ln -sfn "${RELEASE_DIR}" "${DEPLOY_OC_CURRENT}"
else
  if [[ ! -e "${DEPLOY_OC_CURRENT}/openclaw.mjs" ]]; then
    echo "openclaw not deployed. Re-run with --sync" >&2
    exit 2
  fi
fi

WRAPPER="${BIN_DIR}/openclaw"
cat > "${WRAPPER}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
OPENCLAW_HOME="${DEPLOY_OC_CURRENT}"

NODE_VERSION="\$(node -p 'process.versions.node' 2>/dev/null || true)"
NODE_MAJOR="\${NODE_VERSION%%.*}"
NODE_MINOR="\${NODE_VERSION#*.}"
NODE_MINOR="\${NODE_MINOR%%.*}"

if [[ -n "\${NODE_MAJOR}" && -n "\${NODE_MINOR}" ]]; then
  if (( NODE_MAJOR > 22 )) || (( NODE_MAJOR == 22 && NODE_MINOR >= 12 )); then
    exec node "\${OPENCLAW_HOME}/openclaw.mjs" "\$@"
  fi
fi

if command -v npx >/dev/null 2>&1; then
  NODE22="\$(npx -p node@22.12.0 -c 'command -v node' 2>/dev/null || true)"
  if [[ -n "\${NODE22}" ]]; then
    exec "\${NODE22}" "\${OPENCLAW_HOME}/openclaw.mjs" "\$@"
  fi
fi

echo "openclaw requires Node >= 22.12.0 (node found: \${NODE_VERSION:-unknown})." >&2
echo "Install Node 22+ or ensure 'npx' is available for a fallback runtime." >&2
exit 2
EOF

chmod +x "${WRAPPER}"

echo "Installed wrapper: ${WRAPPER}"
echo "Ensure ${BIN_DIR} is in PATH"
