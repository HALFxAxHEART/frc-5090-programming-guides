#!/bin/bash
# Builds the printable PDFs from the Markdown guides.
# Two passes: the second fills the real page numbers into the Contents page.
# Usage: tools/build-print.sh [work dir] [output dir]     (run from the repo root after `cd tools && bun install`)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
G="$HERE/../guides"; W=${1:-/tmp/5090-guides-work}; O=${2:-"$HERE/../print"}
cd "$HERE"
rm -rf "$W" "$O"
bun render-print.ts "$G" "$W" && python3 assemble.py "$W" "$O"
bun render-print.ts "$G" "$W" && python3 assemble.py "$W" "$O"
