# Auth Policy Matrix

## Bootstrap Roles

| Role | Purpose |
|---|---|
| PLATFORM_ADMIN | Full platform administration. |
| TENANT_ADMIN | Tenant-level administration. |
| BLUEPRINT_MANAGER | Blueprint activation and configuration. |
| HRMS_MANAGER | HRMS intelligence model management. |
| PROCESS_OWNER | BPM process ownership. |
| MANAGER | Team/position owner functions. |
| USER | Basic authenticated user. |
| READ_ONLY | Read-only inspection. |

## Permission Matrix

| Permission | PLATFORM_ADMIN | TENANT_ADMIN | BLUEPRINT_MANAGER | HRMS_MANAGER | PROCESS_OWNER | MANAGER | USER | READ_ONLY |
|---|---|---|---|---|---|---|---|---|
| tenant:read | Y | Y | Y | Y | Y | Y | N | Y |
| tenant:create | Y | N | N | N | N | N | N | N |
| user:read | Y | Y | N | Y | N | Y | self | Y |
| user:create | Y | Y | N | N | N | N | N | N |
| auth:role_assign | Y | Y | N | N | N | N | N | N |
| blueprint:read | Y | Y | Y | Y | Y | Y | N | Y |
| blueprint:activate | Y | Y | Y | N | N | N | N | N |
| position:read | Y | Y | Y | Y | Y | Y | Y | Y |
| position:create | Y | Y | N | Y | N | N | N | N |
| skill:read | Y | Y | Y | Y | Y | Y | Y | Y |
| kpi:read | Y | Y | Y | Y | Y | Y | N | Y |
| learning:read | Y | Y | Y | Y | Y | Y | Y | Y |
| compensation:read | Y | Y | N | restricted | N | restricted | N | N |
| seed:discover | Y | Y | Y | Y | N | N | N | N |
| seed:approve | Y | Y | Y | Y | N | N | N | N |
