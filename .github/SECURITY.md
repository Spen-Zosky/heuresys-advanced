# Security Policy

## Supported versions

This is a proprietary product in active development. Security patches are
applied to `main` only. Historical tags are not patched.

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ |
| `v0.2.x-mvp2` and earlier tags | ❌ |

## Reporting a vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Email the maintainer directly: **enzo.spenuso@outlook.com**

Include:
- Affected version / commit hash
- Steps to reproduce (or minimal proof of concept)
- Expected vs observed behavior
- Suggested mitigation (if any)

Response window: best-effort within 72 hours. Critical issues (auth bypass,
data exfiltration, RCE) will be patched on `main` with a priority commit;
non-critical issues are tracked in the private backlog.

## Out of scope

- Vulnerabilities in third-party dependencies — report via Dependabot or
  directly to the upstream project.
- Issues that require physical access to the developer machine.
- Social engineering attacks against the maintainer.

## Past advisories

None published yet. See git log for security-tagged commits when applicable.
