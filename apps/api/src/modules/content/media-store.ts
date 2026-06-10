/**
 * apps/api/src/modules/content/media-store.ts
 * Object-store seam for content media (cap④ CMS P3). The DEFAULT driver is
 * local-disk (decision S980: local-disk-default, S3/MinIO as a config swap —
 * implement this same interface against the S3 SDK and select it via
 * MEDIA_STORAGE_DRIVER when the PM decision lands; no schema change needed).
 *
 * Keys are driver-relative ("<tenantId>/<mediaId>") — never absolute paths —
 * and are generated server-side from UUIDs, so no user input ever reaches the
 * filesystem path (path-traversal is structurally impossible).
 */

import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Readable } from "node:stream";

export interface ObjectStore {
  /** Persist a blob under the key (overwrites). */
  put(key: string, data: Buffer): Promise<void>;
  /** Stream a blob back; the caller pipes it into the reply. */
  createReadStream(key: string): Readable;
  /** Remove a blob (idempotent — missing keys are fine). */
  delete(key: string): Promise<void>;
}

export class LocalDiskStore implements ObjectStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    // Keys are server-generated UUID segments; resolve + prefix-check anyway
    // (defense in depth against a future caller passing user input).
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root)) {
      throw new Error("media storage key escapes the storage root");
    }
    return p;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.pathFor(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  createReadStream(key: string): Readable {
    return createReadStream(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
