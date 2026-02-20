# Thirdparty Claws Benchmark Notes

Last updated: 2026-02-19

## Current benchmark status

Source: `summary.csv` in this folder.

- `zeroclaw`: `ok`
- `openclaw`: `ok`
- `nanobot`: `ok`

## Safety model used

- No global package install.
- No system PATH changes.
- No service/system configuration changes.
- Nanobot dependencies are installed only in submodule-local paths:
  - `thirdparty/mynanobot/.venv-bench`
  - `thirdparty/mynanobot/.bench-home`
  - `thirdparty/mynanobot/.bench-pip-cache`

## Rebuild isolated nanobot env

```bash
/Users/litianyi/Documents/__secondlife/__project/myr2d2/scripts/bench/rebuild-nanobot-bench-env.sh
```

## Clean isolated nanobot env

```bash
/Users/litianyi/Documents/__secondlife/__project/myr2d2/scripts/bench/rebuild-nanobot-bench-env.sh --clean-only
```

## Benchmark command (safe manifest)

```bash
bash /Users/litianyi/Documents/__secondlife/__project/myr2d2/scripts/bench/compare-thirdparty-claws.sh \
  --manifest /Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/benchmarks/thirdparty-claws-latest/manifest.safe.tsv \
  --runs 3 \
  --out-dir /Users/litianyi/Documents/__secondlife/__project/myr2d2/doc/benchmarks/thirdparty-claws-latest
```

## Note

If nanobot env has been cleaned, run the rebuild command first; otherwise nanobot will fail with missing Python deps (for example `ModuleNotFoundError: typer`).
