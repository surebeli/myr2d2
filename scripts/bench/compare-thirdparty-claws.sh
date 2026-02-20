#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

RUNS=3
MANIFEST=""
OUT_DIR=""

usage() {
  cat <<USAGE
Usage: $(basename "$0") [--manifest <tsv>] [--runs <n>] [--out-dir <dir>]

Benchmarks startup latency and max RSS using /usr/bin/time -l.
Manifest format (tab-separated):
  name<TAB>working_dir<TAB>command
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --runs)
      RUNS="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
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

if ! command -v /usr/bin/time >/dev/null 2>&1; then
  echo "ERROR: /usr/bin/time is required (macOS/BSD time)." >&2
  exit 1
fi

if [[ -z "$OUT_DIR" ]]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  OUT_DIR="$ROOT_DIR/doc/benchmarks/thirdparty-claws-$TS"
fi
mkdir -p "$OUT_DIR"

if [[ -z "$MANIFEST" ]]; then
  MANIFEST="$OUT_DIR/default-apps.tsv"
  cat > "$MANIFEST" <<MANIFEST_EOF
zeroclaw	$ROOT_DIR/thirdparty/myzeroclaw	[[ -x target/release/zeroclaw ]] && target/release/zeroclaw --help || cargo run --release -- --help
openclaw	$ROOT_DIR/thirdparty/myopenclaw	node openclaw.mjs --help
nanobot	$ROOT_DIR/thirdparty/mynanobot	python3 -m nanobot --help
MANIFEST_EOF
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: Manifest not found: $MANIFEST" >&2
  exit 1
fi

CSV="$OUT_DIR/summary.csv"
MD="$OUT_DIR/summary.md"

printf 'name,status,exit_code,elapsed_seconds,max_rss_kb,command\n' > "$CSV"

format_num() {
  awk -v v="$1" 'BEGIN { if (v == "") { print "n/a" } else { printf "%.4f", v } }'
}

while IFS=$'\t' read -r name workdir cmd || [[ -n "${name:-}" ]]; do
  [[ -z "${name:-}" ]] && continue
  [[ "${name:0:1}" == "#" ]] && continue

  app_dir="$workdir"
  elapsed_sum="0"
  elapsed_count=0
  max_rss=0
  status="ok"
  exit_code=0

  for i in $(seq 1 "$RUNS"); do
    run_log="$OUT_DIR/${name}.run${i}.log"
    run_err="$OUT_DIR/${name}.run${i}.stderr.log"
    time_log="$OUT_DIR/${name}.run${i}.time.log"

    # First run determines true command success/failure.
    set +e
    (cd "$app_dir" && bash -lc "$cmd") > "$run_log" 2> "$run_err"
    rc=$?
    set -e

    if (( rc != 0 )); then
      status="failed"
      exit_code=$rc
      break
    fi

    # Second run samples timing/memory. If -l is blocked (sandbox), degrade to -p.
    set +e
    (cd "$app_dir" && /usr/bin/time -l bash -lc "$cmd") > /dev/null 2> "$time_log"
    time_rc=$?
    set -e

    if (( time_rc != 0 )) && grep -q 'sysctl kern.clockrate' "$time_log"; then
      set +e
      (cd "$app_dir" && /usr/bin/time -p bash -lc "$cmd") > /dev/null 2> "$time_log"
      time_rc=$?
      set -e
    fi

    # Support both BSD time (-l: "<seconds> real ...") and POSIX time (-p: "real <seconds>")
    real_s="$(awk '$2 == "real" { print $1; exit } $1 == "real" { print $2; exit }' "$time_log")"
    rss_kb="$(awk '/maximum resident set size/ { print $1; exit }' "$time_log")"

    if [[ -n "$real_s" ]]; then
      elapsed_sum="$(awk -v a="$elapsed_sum" -v b="$real_s" 'BEGIN { printf "%.6f", a + b }')"
      elapsed_count=$((elapsed_count + 1))
    fi

    if [[ -n "$rss_kb" ]] && [[ "$rss_kb" =~ ^[0-9]+$ ]] && (( rss_kb > max_rss )); then
      max_rss=$rss_kb
    fi

  done

  if (( elapsed_count > 0 )); then
    avg_elapsed="$(awk -v s="$elapsed_sum" -v c="$elapsed_count" 'BEGIN { printf "%.6f", s / c }')"
  else
    avg_elapsed=""
  fi

  if (( max_rss == 0 )); then
    max_rss_field="n/a"
  else
    max_rss_field="$max_rss"
  fi

  elapsed_field="$(format_num "$avg_elapsed")"

  printf '%s,%s,%s,%s,%s,%s\n' \
    "$name" "$status" "$exit_code" "$elapsed_field" "$max_rss_field" "$cmd" >> "$CSV"
done < "$MANIFEST"

{
  echo "# Benchmark Summary"
  echo
  echo "- Generated at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "- Runs per app: $RUNS"
  echo "- Manifest: $MANIFEST"
  echo
  echo "| Name | Status | Exit Code | Avg Elapsed (s) | Max RSS (KB) |"
  echo "|---|---:|---:|---:|---:|"
  tail -n +2 "$CSV" | while IFS=',' read -r name status code elapsed rss _cmd; do
    echo "| $name | $status | $code | $elapsed | $rss |"
  done
} > "$MD"

echo "Done."
echo "- CSV: $CSV"
echo "- Markdown: $MD"
