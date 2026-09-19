#!/usr/bin/env python3
"""Misura I-B: fisicità delle 13 tabelle di semilavorato."""

import csv
import subprocess
import json
import sys

TABELLE = [
    'sys_skill_families',
    'sys_skill_categories',
    'sys_skill_taxonomy_edges',
    'sys_job_families',
    'sys_skills',
    'sys_job_roles',
    'sys_tenant_blueprints',
    'sys_survey_templates',
    'sys_goal_templates',
    'sys_engagement_survey_templates',
    'sys_organization_unit_templates',
    'sys_process_kpi_templates',
    'sys_organization_unit_kpi_templates',
]

def run_q(query):
    """Esegui una query con q.py e ritorna le righe come lista di dict."""
    proc = subprocess.run(
        [sys.executable, '.programmi/K-ruoli-direzione/tools/q.py', query],
        capture_output=True,
        text=True,
        cwd='D:\\heuresys-advanced'
    )
    if proc.returncode != 0:
        print(f"ERRORE: {proc.stderr.strip()}", file=sys.stderr)
        return None
    reader = csv.DictReader(proc.stdout.strip().split('\n'))
    return list(reader) if reader else []

def misura_tabella(tabella):
    """Misura una tabella."""
    # Colonne
    cols_query = f"SELECT column_name FROM information_schema.columns WHERE table_schema='sys' AND table_name='{tabella}' ORDER BY ordinal_position"
    cols = run_q(cols_query)
    if cols is None:
        return None

    col_names = [c['column_name'] for c in cols]
    ha_tenant = 'tenant_id' in col_names
    ha_bandiera_globale = any(c.endswith('_is_global') for c in col_names)
    ha_generated_record_origins = 'generated_record_id' in col_names

    # Conteggi
    total = run_q(f"SELECT COUNT(*) as n FROM sys.{tabella}")
    total_n = int(total[0]['n']) if total and total[0]['n'] else 0

    if ha_tenant:
        # Distinguere per tenant_id
        platform = run_q(f"SELECT COUNT(*) as n FROM sys.{tabella} WHERE tenant_id IS NULL")
        platform_n = int(platform[0]['n']) if platform and platform[0]['n'] else 0
        client = run_q(f"SELECT COUNT(*) as n FROM sys.{tabella} WHERE tenant_id IS NOT NULL")
        client_n = int(client[0]['n']) if client and client[0]['n'] else 0
    else:
        platform_n = total_n
        client_n = 0

    if ha_generated_record_origins:
        with_origin = run_q(f"SELECT COUNT(*) as n FROM sys.{tabella} WHERE generated_record_id IS NOT NULL")
        with_origin_n = int(with_origin[0]['n']) if with_origin and with_origin[0]['n'] else 0
    else:
        with_origin_n = 0

    return {
        'tabella': tabella,
        'colonne': col_names,
        'num_colonne': len(col_names),
        'ha_tenant_id': ha_tenant,
        'ha_bandiera_globale': ha_bandiera_globale,
        'ha_generated_record_id': ha_generated_record_origins,
        'totale_righe': total_n,
        'righe_piattaforma': platform_n,
        'righe_cliente': client_n,
        'righe_con_origin': with_origin_n,
    }

if __name__ == '__main__':
    risultati = []
    for tabella in TABELLE:
        print(f"Misurando {tabella}...", file=sys.stderr)
        r = misura_tabella(tabella)
        if r:
            risultati.append(r)

    print(json.dumps(risultati, indent=2))
