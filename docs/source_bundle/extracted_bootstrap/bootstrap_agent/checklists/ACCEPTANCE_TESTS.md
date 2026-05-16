# Bootstrap Acceptance Tests

The Development Team must not mark bootstrap complete until these tests pass.

## Repository

- [ ] Repository structure exists.
- [ ] `.env.example` exists.
- [ ] `docker-compose.yml` exists.
- [ ] Source bundle is copied to `docs/source_bundle/`.
- [ ] README includes run instructions.

## Database

- [ ] PostgreSQL starts via Docker Compose.
- [ ] Schema `sys` exists.
- [ ] All migrations run idempotently twice.
- [ ] No migration is destructive.
- [ ] `sys.sys_tenancies` exists.
- [ ] `sys.sys_users` exists.
- [ ] `sys.sys_users.user_tenant_id` references `sys.sys_tenancies.tenant_id`.
- [ ] Auth tables exist.
- [ ] Profile/evidence tables exist.
- [ ] Position and assignment tables exist.
- [ ] Seed acquisition staging tables exist.
- [ ] Visualization graph tables exist.

## Reference Tenant

- [ ] Reference tenant exists.
- [ ] Reference bank profile says 158 employees.
- [ ] Branch count equals 5.
- [ ] Branch employee count equals 25.
- [ ] Synthetic users are flagged as synthetic.
- [ ] Position count validates against target model.
- [ ] User-position assignments are tenant-consistent.

## API

- [ ] API starts.
- [ ] `/auth/login` works.
- [ ] `/auth/me` works.
- [ ] `/tenants` returns data.
- [ ] `/users` returns data.
- [ ] `/positions` returns data.
- [ ] `/visualizations` returns graph list.

## Frontend

- [ ] Login page renders.
- [ ] Dashboard shell renders.
- [ ] Tenant list renders.
- [ ] User list renders.
- [ ] Position list renders.
- [ ] Position Intelligence Profile renders.
- [ ] Process registry browser renders.
- [ ] Visualization viewer renders.

## Seed Acquisition

- [ ] Source registry loads.
- [ ] Candidate seed run can be created.
- [ ] Candidate records are staged, not directly canonical.
- [ ] Source evidence is stored.
- [ ] Candidate records require approval before canonical seed.

## Visualization

- [ ] Org chart graph can be generated.
- [ ] Learning path graph can be generated.
- [ ] Career path graph can be generated.
- [ ] Generic graph JSON can be returned by API.


## Brownfield Adaptation

- [ ] If `db-export.zip` is provided, it is inspected but not imported directly.
- [ ] `BROWNFIELD_ADAPTATION_MAP.md` is generated.
- [ ] Every old table is classified.
- [ ] Excluded domains are not imported.
- [ ] Candidate records are staged before canonical insert.
- [ ] Brownfield lineage records are created.
- [ ] Approved imports are idempotent.
- [ ] New target architecture remains unchanged.
