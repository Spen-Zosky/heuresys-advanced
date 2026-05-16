param(
  [string]$Root = "company-hrms-bpm"
)

$dirs = @(
  "docs/source_bundle","docs/architecture","docs/db","docs/auth","docs/api","docs/frontend","docs/security","docs/decisions",
  "db/migrations","db/seeds","db/scripts",
  "apps/api/src/db","apps/api/src/middleware","apps/api/src/config",
  "apps/api/src/modules/auth","apps/api/src/modules/tenants","apps/api/src/modules/users","apps/api/src/modules/user-profiles",
  "apps/api/src/modules/positions","apps/api/src/modules/skills","apps/api/src/modules/kpis","apps/api/src/modules/learning",
  "apps/api/src/modules/assessments","apps/api/src/modules/career","apps/api/src/modules/compensation",
  "apps/web/src/app","apps/web/src/components","apps/web/src/lib",
  "apps/web/src/features/auth","apps/web/src/features/tenants","apps/web/src/features/users","apps/web/src/features/enterprise-typing",
  "apps/web/src/features/blueprints","apps/web/src/features/positions","apps/web/src/features/skills","apps/web/src/features/kpis",
  "apps/web/src/features/learning","apps/web/src/features/dashboards",
  "packages/shared/src/schemas","packages/shared/src/types",
  "tests/db","tests/api","tests/e2e","qa_artifacts"
)

foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null
}
Write-Host "Created repository structure at $Root"
