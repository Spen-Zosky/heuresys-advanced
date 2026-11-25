#!/usr/bin/env bash
# esegui_tutto.sh - rigenera l'inventario V1 (sola lettura sui repository).
# USO: HEURESYS_ADVANCED=<repo advanced> HEURESYS_DATASTORE=<repo datastore> bash esegui_tutto.sh <cartella-di-uscita>
set -euo pipefail
QUI="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:?cartella di uscita}"
export HEURESYS_ADVANCED="${HEURESYS_ADVANCED:?}" HEURESYS_DATASTORE="${HEURESYS_DATASTORE:?}"
mkdir -p "$OUT/dati"
python3 "$QUI/estrai_endpoint.py" --out "$OUT"
python3 "$QUI/estrai_pagine_v1.py" --endpoint "$OUT/dati/endpoint.json" --out "$OUT"
python3 "$QUI/estrai_console.py" --out "$OUT"
python3 "$QUI/genera_tsv.py" --out "$OUT"
