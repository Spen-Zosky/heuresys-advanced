#!/usr/bin/env bash
# La corsa della batteria sulla copia del database (gemello): avvia un gateway proprio, verifica le
# risposte attese, pone le domande, ferma il gateway. Si lancia dalla radice del repo, sulla macchina
# che ha il database e l'API (mai sulla produzione: ogni domanda apre una conversazione).
#
#   BATTERIA_SU_COPIA=1 bash apps/agent-gateway/scripts/batteria-corsa.sh <cartella-uscita> [opzioni di batteria-corri.ts]
#
# Variabili: HEURESYS_API (predefinita http://127.0.0.1:8013), BATTERIA_PORTA (8791).
# Rilanciato sulla stessa cartella riprende la corsa. Uscita: quella di batteria-corri.ts.
set -euo pipefail

uscita="${1:?uso: batteria-corsa.sh <cartella-uscita> [opzioni]}"; shift
radice="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
export HEURESYS_API="${HEURESYS_API:-http://127.0.0.1:8013}"
porta="${BATTERIA_PORTA:-8791}"
mkdir -p "$uscita"
uscita="$(cd "$uscita" && pwd)"
cd "$radice/apps/agent-gateway"

# Solo su una copia (due condizioni): lo dichiara chi lancia, e qui non gira la produzione.
if [ "${BATTERIA_SU_COPIA:-}" != "1" ] || [ -d "$HOME/heuresys-servizio/advanced-produzione" ]; then
  echo "[batteria] rifiuto: serve BATTERIA_SU_COPIA=1 su una macchina che non serve la produzione" >&2
  exit 2
fi

# Il token di lunga durata degli agenti: si carica nell'ambiente, non si stampa.
. "$HOME/.claude/tools/token-agenti.sh" carica

tenant_rtl="86ba7a65-217f-48ba-8ce5-5c09b40a66b0"
if curl -fsS "http://127.0.0.1:$porta/healthz" >/dev/null 2>&1; then
  echo "[batteria] la porta $porta è già occupata: non avvio un secondo gateway" >&2
  exit 2
fi
env -u ANTHROPIC_API_KEY \
  AGENT_GATEWAY_PORT="$porta" AGENT_GATEWAY_SUBSCRIPTION_AUTH=1 HEURESYS_REPO_ROOT="$radice" \
  AGENT_GATEWAY_ALLOWED_TENANT_IDS="$tenant_rtl" AGENT_GATEWAY_MAX_CONVERSAZIONI=6 AGENT_GATEWAY_MAX_CONVERSAZIONI_PERSONA=4 \
  AGENT_GATEWAY_AUDIT_PATH="$uscita/diario-gateway.jsonl" \
  node_modules/.bin/tsx src/server.ts >>"$uscita/gateway.log" 2>&1 &
gateway=$!
trap 'kill "$gateway" 2>/dev/null || true; wait "$gateway" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$porta/healthz" >/dev/null 2>&1 && break
  kill -0 "$gateway" 2>/dev/null || { tail -20 "$uscita/gateway.log" >&2; exit 2; }
  sleep 1
done

# Le domande si generano e si verificano sullo stesso database che il gateway legge, una volta per corsa.
[ -f "$uscita/domande.json" ] || node_modules/.bin/tsx scripts/batteria-genera.ts --esci "$uscita/domande.json"
node_modules/.bin/tsx scripts/batteria-verifica.ts --domande "$uscita/domande.json" || { echo "[batteria] attese vecchie: rigenera domande.json nella cartella di uscita" >&2; exit 2; }

AGENT_GATEWAY="http://127.0.0.1:$porta" node_modules/.bin/tsx scripts/batteria-corri.ts \
  --domande "$uscita/domande.json" --registro "$uscita/registro.jsonl" "$@"
