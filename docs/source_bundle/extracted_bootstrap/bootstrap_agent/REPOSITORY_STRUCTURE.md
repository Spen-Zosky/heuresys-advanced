# Repository Structure

Recommended clean repository structure:

```text
company-hrms-bpm/
  README.md
  ISTRUZIONI.md
  .env.example
  .gitignore
  docker-compose.yml

  docs/
    source_bundle/
    architecture/
    db/
    auth/
    api/
    frontend/
    security/
    decisions/

  db/
    migrations/
    seeds/
    scripts/

  apps/
    api/
      package.json
      src/
        modules/
          auth/
          tenants/
          users/
          user-profiles/
          positions/
          skills/
          kpis/
          learning/
          assessments/
          career/
          compensation/
        db/
        middleware/
        config/
        server.ts

    web/
      package.json
      src/
        app/
        components/
        features/
          auth/
          tenants/
          users/
          enterprise-typing/
          blueprints/
          positions/
          skills/
          kpis/
          learning/
          dashboards/
        lib/

  packages/
    shared/
      src/
        schemas/
        types/

  tests/
    db/
    api/
    e2e/

  qa_artifacts/
```
