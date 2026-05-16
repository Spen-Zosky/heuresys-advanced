# ADR‑0005 — Password Hashing: Argon2id

- **Status:** Accepted
- **Date:** 2026‑05‑16

## Context

`AUTH_STACK_SPEC.md` permits either **Argon2** or **bcrypt** for password hashing. We need:

1. OWASP 2024 compliance.
2. Memory‑hardness (resistant to GPU and ASIC attacks).
3. Mature Node.js binding.
4. Predictable performance on the target hardware (Windows PC + ARM VM).

## Decision

**Argon2id** via the `argon2` npm package (>= 0.31).

Parameters (OWASP 2024 baseline):

```ts
import argon2 from "argon2";

const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,        // 64 MiB
  timeCost: 3,              // 3 iterations
  parallelism: 4,           // 4 lanes
  hashLength: 32,           // 32-byte output
} as const;
```

Implementation rules:

- Hashing happens in the `auth` module service layer, never in routes.
- Verification uses `argon2.verify(stored, input)` which constant‑time compares.
- Rehash on login if `argon2.needsRehash(stored, ARGON2_PARAMS)` returns true (allows parameter migration).
- Never log the hash; never include it in API responses.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **bcrypt (cost 12)** | Mature, well‑known | No memory‑hardness; weaker against GPU; OWASP recommends Argon2id since 2023 | Argon2id is the modern default |
| **scrypt** | Memory‑hard | Less mature Node binding; fewer hardware‑tuning knobs | Argon2id has better tuning controls |
| **PBKDF2‑HMAC‑SHA512** | Built into Node `crypto` | Not memory‑hard; less effective vs GPU | Below OWASP 2024 baseline for new systems |

## Consequences

**Positive:**

- Strong against the threat model (GPU‑accelerated offline attacks).
- Tunable: we can raise memory/time costs as hardware improves without changing the schema.
- The hash itself encodes the parameters (`$argon2id$v=19$m=65536,t=3,p=4$...`); migration is straightforward.

**Negative:**

- `argon2` native bindings need a C toolchain on first install. On Windows we document `npm install -g node-gyp` and Visual Studio Build Tools as prerequisites in `AUTH_SECURITY_PLAN.md`.
- Memory cost of 64 MiB per hash means we cap concurrent login attempts (Fastify rate limit per IP handles this; see ADR‑0006).

**Neutral:**

- bcrypt fallback remains possible (the auth schema stores `algorithm` per credential) but is not the default.

## References

- Consumed by: `AUTH_SECURITY_PLAN.md`.
- See also: ADR‑0006 (auth strategy).
