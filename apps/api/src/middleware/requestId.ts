/**
 * apps/api/src/middleware/requestId.ts
 * Generates / propagates an x-request-id per request; attaches it to the
 * per-request logger child for correlation across all log lines + errors.
 *
 * Fastify itself supports requestId via `genReqId` in the constructor — we
 * use that, plus this plugin to mirror the id on the response header for
 * downstream tracing.
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { HEADERS } from "../config/constants.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (req, reply) => {
    const incoming = req.headers[HEADERS.REQUEST_ID];
    const id = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    req.id = id;
    reply.header(HEADERS.REQUEST_ID, id);
  });
};

export const requestIdPlugin = fp(plugin, { name: "requestId" });
