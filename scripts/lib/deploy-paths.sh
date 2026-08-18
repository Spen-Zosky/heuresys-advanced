# shellcheck shell=bash
# scripts/lib/deploy-paths.sh — I PATH CHE DECIDONO, definiti UNA VOLTA SOLA.
#
# PERCHE' ESISTE (S1069). Questa regola stava scritta in QUATTRO posti, byte-identica:
#
#   scripts/align-clones.sh      DEPLOY_PATHS_RE   — decide se propagare col deploy
#   scripts/close-propagate.sh   ARM_PATHS_RE      — decide se ARMARE refs/heads/prod
#   scripts/deploy-watch.sh      DEPLOY_PATHS_RE   — decide se un commit intermedio pretende il verde
#   scripts/verifica-deploy.sh   _re               — decide su cosa si legge il verdetto
#
# Due di quei file portavano gia' scritto, nei commenti, il pericolo: se le copie divergessero
# «questa riga rassicurerebbe su un criterio e il deploy partirebbe su un altro». Il difetto non
# si e' mai manifestato perche' nessuno le ha toccate — cioe' per fortuna, non per costruzione.
# Quattro copie di una regola sono quattro occasioni di divergere, e la quinta la scrive chi
# aggiunge un percorso nuovo conoscendone solo tre.
#
# COME SI USA
#   . "$(git rev-parse --show-toplevel)/scripts/lib/deploy-paths.sh"
# oppure, dove il repo e' gia' noto:
#   . "$REPO_DIR/scripts/lib/deploy-paths.sh"
#
# COSA NON E'. Non e' il router di `verify_gate.py` (`ROUTES`), e i due non vanno fusi:
# rispondono a domande diverse — «quali PROVE rifare» contro «cosa PROPAGARE», e misurano
# universi diversi (il working tree contro una finestra di commit). Tenerli separati e'
# una scelta; confonderli sarebbe un difetto.

# I percorsi il cui cambiamento rende necessario un deploy: codice, migrazioni, script di
# servizio, unit di sistema. Un commit che tocca solo documenti non ne fa parte.
DEPLOY_PATHS_RE='^(apps|packages|db/migrations|db/scripts|scripts|deploy)/'

# Piu' stretta: solo cio' che cambia la FORMA o il CONTENUTO del database rende obsoleto il
# clone del gemello. Un cambiamento di codice non lo tocca.
CLONE_DB_PATHS_RE='^db/(migrations|seeds)/'
