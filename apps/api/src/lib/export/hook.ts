/**
 * apps/api/src/lib/export/hook.ts — 3.5 reporting/export.
 *
 * A single global onSend hook turns ANY `{items,total}` list endpoint into a
 * downloadable file when the request carries `?format=csv|xlsx|pdf` — zero-touch
 * on the ~85 list routes, and it runs AFTER the handler so RBAC/scope/filters are
 * already applied (the export only ever contains what the caller was authorised
 * to see). `format` is read from the raw URL because the Zod querystring schemas
 * strip unknown keys (verified: 0 strict querystring schemas) — so an unknown or
 * absent format is silently ignored and the normal JSON response is returned.
 *
 * Scope note: the export reflects the CURRENT result (filters + pagination). To
 * export everything, request a large page size. Nested aggregate views keep their
 * dedicated endpoint (analytics/:view/export) — they are not `{items}` lists.
 */
import type { FastifyInstance } from "fastify";
import { listToCsv, listToXlsx, listToPdf } from "./serializers.js";
import { todayDateOnly } from "../date-only.js";

const FORMATS = new Set(["csv", "xlsx", "pdf"]);

const CONTENT_TYPE: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** Extract a supported `?format=` value from the raw URL, or null. */
function parseFormat(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const q = rawUrl.indexOf("?");
  if (q < 0) return null;
  const params = new URLSearchParams(rawUrl.slice(q + 1));
  const fmt = params.get("format");
  return fmt && FORMATS.has(fmt) ? fmt : null;
}

/** Derive a filename stem from the path: /v1/me/skills → "me-skills". */
function resourceName(rawUrl: string | undefined): string {
  if (!rawUrl) return "export";
  const path = rawUrl.split("?")[0] ?? "";
  const stem = path
    .replace(/^\/+/, "")
    .replace(/^v1\//, "")
    .replace(/\/+$/, "")
    .replace(/\//g, "-");
  return stem || "export";
}

export function addExportHook(app: FastifyInstance): void {
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "GET") return payload;
    const fmt = parseFormat(request.raw.url);
    if (!fmt) return payload;
    if (reply.statusCode !== 200) return payload;
    const ct = reply.getHeader("content-type");
    if (typeof ct !== "string" || !ct.includes("application/json")) return payload;
    if (typeof payload !== "string") return payload;

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return payload;
    }
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as { items?: unknown }).items)
    ) {
      return payload;
    }
    const items = (parsed as { items: Record<string, unknown>[] }).items;

    const resource = resourceName(request.raw.url);
    const stamp = todayDateOnly();
    const filename = `${resource}-${stamp}.${fmt}`;

    let body: string | Buffer;
    if (fmt === "csv") body = listToCsv(items);
    else if (fmt === "xlsx") body = await listToXlsx(items, resource);
    else body = await listToPdf(items, resource);

    reply.header("content-type", CONTENT_TYPE[fmt]);
    reply.header("content-disposition", `attachment; filename="${filename}"`);
    reply.header("content-length", typeof body === "string" ? Buffer.byteLength(body) : body.length);
    return body;
  });
}
