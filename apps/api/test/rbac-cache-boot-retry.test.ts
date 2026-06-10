import { describe, it, expect } from 'vitest';
import {
  loadRolePermissionCacheWithRetry,
  type CacheLoadResult,
} from '../src/modules/auth/cache-loader.js';

// D-20 — boot resilience. Unit-level (no DB): the loader is injected, so these
// tests exercise only the retry/backoff/fail-fast policy around the boot load.

const silentLog = { warn: () => {} };
const okStats: CacheLoadResult = { rolesLoaded: 8, mappingsLoaded: 394, unknownRolesSkipped: [] };
const TINY_BACKOFF = [1, 1, 1, 1] as const;

describe('D-20 — RBAC cache boot retry', () => {
  it('retries transient pool-establishment failures and resolves when the loader recovers', async () => {
    let calls = 0;
    const loader = async (): Promise<CacheLoadResult> => {
      calls++;
      if (calls <= 4) throw new Error('Connection terminated due to connection timeout');
      return okStats;
    };
    const warned: unknown[] = [];
    const log = { warn: (obj: unknown) => warned.push(obj) };

    const result = await loadRolePermissionCacheWithRetry(log, loader, TINY_BACKOFF);
    expect(result).toEqual(okStats);
    expect(calls).toBe(5); // observed S980 shape: 4 failures, ok at the 5th
    expect(warned).toHaveLength(4);
  });

  it('gives up after exhausting the backoff slots and rethrows the last error', async () => {
    let calls = 0;
    const loader = async (): Promise<CacheLoadResult> => {
      calls++;
      throw new Error('Connection terminated due to connection timeout');
    };

    await expect(loadRolePermissionCacheWithRetry(silentLog, loader, TINY_BACKOFF)).rejects.toThrow(
      /connection timeout/,
    );
    expect(calls).toBe(TINY_BACKOFF.length + 1);
  });

  it('fails fast on the empty-cache seed defect without retrying', async () => {
    let calls = 0;
    const loader = async (): Promise<CacheLoadResult> => {
      calls++;
      throw new Error(
        'RBAC permission cache is empty — sys.sys_auth_role_permissions returned no rows for any known role.',
      );
    };

    await expect(loadRolePermissionCacheWithRetry(silentLog, loader, TINY_BACKOFF)).rejects.toThrow(
      /cache is empty/,
    );
    expect(calls).toBe(1); // a successful-but-empty load is a data defect, not jitter
  });
});
