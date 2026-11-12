#!/usr/bin/env python3
"""Avvolge una migrazione storica in una guardia: dove l'allineamento di RTL alla corsa e' gia' stato applicato
(esiste il suo giornale staging.rtl_allinea_org_undo) il file non fa niente; altrove (CI, database nuovi) gira com'era.
Uso: python3 avvolgi_migrazione.py db/migrations/000245_*.sql   (idempotente: un file gia' avvolto non si riavvolge)"""
import sys
M = "-- GUARDIA ALLINEAMENTO-RTL"
for p in sys.argv[1:]:
    with open(p, encoding="utf-8") as f:
        s = f.read()
    if M in s:
        continue
    guard = (M + " (ADR-0035): questo file racconta un passaggio storico di RTL che l'allineamento alla corsa (db/scripts/rtl-allinea) ha superato.\n"
             "-- Dove il giornale dell'allineamento esiste il corpo si salta; altrove si applica come sempre.\n"
             "SELECT (to_regclass('staging.rtl_allinea_org_undo') IS NULL) AS esegui_storica \\gset\n\\if :esegui_storica\n")
    with open(p, "w", encoding="utf-8") as f:
        f.write(guard + s.rstrip("\n") + "\n\\endif\n")
    print("avvolto", p)
