#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-company-hrms-bpm}"
mkdir -p "$ROOT"/{docs/source_bundle,docs/architecture,docs/db,docs/auth,docs/api,docs/frontend,docs/security,docs/decisions}
mkdir -p "$ROOT"/db/{migrations,seeds,scripts}
mkdir -p "$ROOT"/apps/api/src/modules/{auth,tenants,users,user-profiles,positions,skills,kpis,learning,assessments,career,compensation}
mkdir -p "$ROOT"/apps/api/src/{db,middleware,config}
mkdir -p "$ROOT"/apps/web/src/{app,components,lib}
mkdir -p "$ROOT"/apps/web/src/features/{auth,tenants,users,enterprise-typing,blueprints,positions,skills,kpis,learning,dashboards}
mkdir -p "$ROOT"/packages/shared/src/{schemas,types}
mkdir -p "$ROOT"/tests/{db,api,e2e}
mkdir -p "$ROOT"/qa_artifacts
echo "Created repository structure at $ROOT"
