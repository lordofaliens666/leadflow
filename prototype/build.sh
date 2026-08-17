#!/usr/bin/env bash
# Reassembles the InScreens artifact prototype from its source parts.
# Usage: ./build.sh  (run from the prototype/ directory, or anywhere — it cd's to its own location)
set -euo pipefail
cd "$(dirname "$0")"

cat src/part1.html src/fontfaces.css src/part2.html src/part3.html > dist/inscreens-prototype.html

echo "Built dist/inscreens-prototype.html ($(wc -c < dist/inscreens-prototype.html) bytes)"
