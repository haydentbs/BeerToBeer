#!/usr/bin/env bash
# Regenerates ordered PNGs: font-preview-01-space-grotesk.png, …
# Requires: npm run build && PORT=<port> npm run start
set -euo pipefail
PORT="${PORT:-3004}"
BASE="http://localhost:${PORT}"

IDS=(
  space-grotesk
  archivo-black
  syne
  bebas-neue
  rubik
  anton
  unbounded
  lexend
  oswald
  staatliches
  righteous
  black-ops-one
  orbitron
  outfit
  bungee
  bungee-inline
  bungee-shade
  bowlby-one
  titan-one
  luckiest-guy
  bangers
  rubik-mono-one
  bungee-lexend
  impact-georgia
  pptx-hackathon
)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

i=1
for id in "${IDS[@]}"; do
  num=$(printf '%02d' "$i")
  out="font-preview-${num}-${id}.png"
  echo "→ $out"
  npx playwright screenshot --full-page --wait-for-timeout=1200 "${BASE}/font-preview?id=${id}" "$out"
  i=$((i + 1))
done

echo "Done. ${#IDS[@]} files in $ROOT"
