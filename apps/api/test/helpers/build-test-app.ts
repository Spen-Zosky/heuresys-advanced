/**
 * apps/api/test/helpers/build-test-app.ts
 * Wraps src/app.ts buildApp() and src/modules/auth/cache-loader.ts so each
 * test boots a fresh Fastify instance that shares the singleton DB pool.
 * Returns the instance + the InMemoryMailer for assertion access.
 *
 * Tests should call `await app.close()` in afterEach to release Fastify
 * resources. The DB pool stays open across the suite (closed in afterAll
 * of any test that wants to be the last one).
 */

import { buildApp } from "../../src/app.js";
import { loadRolePermissionCache } from "../../src/modules/auth/cache-loader.js";
import { InMemoryMailer } from "../../src/modules/auth/mailer.js";
import type { FastifyInstance } from "fastify";

export interface TestApp {
  app: FastifyInstance;
  mailer: InMemoryMailer;
}

let cacheLoadedOnce = false;

export async function buildTestApp(): Promise<TestApp> {
  if (!cacheLoadedOnce) {
    await loadRolePermissionCache();
    cacheLoadedOnce = true;
  }
  const mailer = new InMemoryMailer();
  const app = await buildApp({ authMailer: mailer });
  await app.ready();
  return { app, mailer };
}
