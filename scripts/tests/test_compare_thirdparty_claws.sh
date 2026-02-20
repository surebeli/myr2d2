#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/bench/compare-thirdparty-claws.sh"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

MANIFEST="$TMP_DIR/apps.tsv"
OUT_DIR="$TMP_DIR/out"

cat > "$MANIFEST" <<MANIFEST_EOF
ok_app	$ROOT_DIR	printf ok
fail_app	$ROOT_DIR	false
MANIFEST_EOF

bash "$SCRIPT" --manifest "$MANIFEST" --runs 1 --out-dir "$OUT_DIR"

CSV="$OUT_DIR/summary.csv"
MD="$OUT_DIR/summary.md"

[[ -f "$CSV" ]]
[[ -f "$MD" ]]

grep -q '^name,status,exit_code,elapsed_seconds,max_rss_kb,command$' "$CSV"
grep -q '^ok_app,ok,0,' "$CSV"
grep -q '^fail_app,failed,1,' "$CSV"
# elapsed_seconds should be numeric for successful command
awk -F',' '$1=="ok_app" { if ($4 == "n/a") exit 1 }' "$CSV"
grep -q 'Benchmark Summary' "$MD"

echo "PASS: compare-thirdparty-claws benchmark smoke test"
