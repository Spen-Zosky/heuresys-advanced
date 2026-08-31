#!/usr/bin/env bash
# #132 F7 — accende la catena della ricerca SUL GEMELLO, dove il database e' in casa.
#
# Il «fornitore di proposte» non e' un terzo: e' `apps/agent-gateway`, un servizio del
# progetto. Le due variabili che il register chiamava «credenziali» sono l'indirizzo di
# quel servizio e una parola d'ordine condivisa fra lui e l'API.
#
# Il segreto NON viene scritto in nessun `.env`: vive in `~/.research-token` (600) e passa
# solo nell'ambiente dei due processi. Cosi' non finisce in un file versionabile ne' in un
# backup, e per toglierlo basta cancellare un file.
set -u
cd "$HOME/heuresys-advanced" || exit 1
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" >/dev/null 2>&1

TOKEN="$(cat "$HOME/.research-token")"
[ -n "$TOKEN" ] || { echo "token assente"; exit 2; }

echo "=== 1/3 agent-gateway (il fornitore) su :8790"
pkill -f "agent-gateway" 2>/dev/null
cd apps/agent-gateway || exit 1
AGENT_GATEWAY_RESEARCH_TOKEN="$TOKEN" \
AGENT_GATEWAY_SUBSCRIPTION_AUTH=1 \
HEURESYS_API="http://localhost:3001" \
  setsid nohup pnpm dev > /tmp/gw-ricerca.log 2>&1 < /dev/null &

echo "=== 2/3 API su :3001, che sa dove sta il fornitore"
cd "$HOME/heuresys-advanced/apps/api" || exit 1
PORT=3001 \
RESEARCH_GATEWAY_URL="http://localhost:8790" \
RESEARCH_GATEWAY_TOKEN="$TOKEN" \
  setsid nohup pnpm dev > /tmp/api-ricerca.log 2>&1 < /dev/null &

echo "=== 3/3 attendo che rispondano entrambi"
for i in $(seq 1 24); do
  gw=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" \
        -H "x-research-token: $TOKEN" -d '{}' http://localhost:8790/research/propose 2>/dev/null)
  api=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/readyz 2>/dev/null)
  # 400 = il gateway ci parla e rifiuta un corpo vuoto: e' vivo E il token vale.
  if [ "$api" = "200" ] && [ "$gw" != "000" ] && [ "$gw" != "503" ] && [ "$gw" != "401" ]; then
    echo "pronti — api=$api gateway=$gw (401/503 avrebbero detto token sbagliato o assente)"
    exit 0
  fi
  sleep 5
done
echo "NON PRONTI dopo 120s — api=$api gateway=$gw"
echo "--- coda gateway:"; tail -5 /tmp/gw-ricerca.log
echo "--- coda api:";     tail -5 /tmp/api-ricerca.log
exit 1
