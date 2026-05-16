#!/usr/bin/env bash
set -euo pipefail
if [ $# -lt 1 ]; then
  echo "Usage: ./scripts/apply_bundle.sh /path/to/target-folder"
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/apply_bundle.py" --target "$1"
