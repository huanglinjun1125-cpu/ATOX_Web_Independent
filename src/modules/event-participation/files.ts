import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb, serializeDatabaseWrite } from "@/lib/db";
import { eventAssets, eventMaterials } from "@/lib/schema";
import type { AuthUser } from "../auth/contracts";
import type { AssetPurpose } from "./contracts";
import { eventConfig } from "./config";
import { getEventConfig } from "../event-board/config";
import type { EventDefinition } from "../event-board/contracts";
import { EventError } from "./errors";
import {
  buildEventService,
  materialReferences,
  isReviewer,
  validateAssetId,
} from "./service";

export function buildFiles(
  eventConfig: EventDefinition,
  configReader?: Parameters<typeof buildEventService>[1],
) {
  const boundService = buildEventService(eventConfig, configReader);
  type ScopedService = ReturnType<typeof buildEventService>;
  const assertCanEdit = (
    user: AuthUser,
    db?: Parameters<ScopedService["assertCanEdit"]>[1],
  ) => boundService.assertCanEdit(user, db);
  const assetDto = (asset: typeof eventAssets.$inferSelect) =>
    boundService.assetDto(asset);
  function uploadDirectory() {
    const directory = path.resolve(
      /* turbopackIgnore: true */ process.env.UPLOAD_PATH || ".data/uploads",
    );
    const publicDirectory = path.resolve("public");
    const relative = path.relative(publicDirectory, directory);
    if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)))
      throw new Error("UPLOAD_PATH must be outside public");
    return directory;
  }
  function storagePath(storageName: string) {
    if (!/^[a-f0-9-]{36}\.(png|jpeg|webp|pdf)$/.test(storageName))
      throw new EventError("INVALID_FILE");
    return path.join(uploadDirectory(), storageName);
  }
  function nameFor(originalName: string, extension: string) {
    if (typeof originalName !== "string" || originalName.length > 1000)
      throw new EventError("INVALID_FILE");
    const basename = originalName.split(/[\\/]/).pop() ?? "";
    const clean = basename
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .replace(/\.[^.]*$/, "")
      .slice(0, 160);
    return `${clean || "upload"}.${extension}`;
  }
  async function validateContent(purpose: AssetPurpose, buffer: Buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0)
      throw new EventError("INVALID_FILE");
    const max =
      purpose === "document"
        ? eventConfig.fileRules.documentMaxBytes
        : eventConfig.fileRules.imageMaxBytes;
    if (buffer.length > max) throw new EventError("INVALID_FILE");
    try {
      if (purpose === "document") {
        if (
          !/^%PDF-(?:1\.[0-7]|2\.0)/.test(
            buffer.subarray(0, 8).toString("ascii"),
          ) ||
          !/%%EOF\s*$/.test(buffer.subarray(-1024).toString("latin1"))
        )
          throw new Error();
        const pdf = await PDFDocument.load(buffer, {
          ignoreEncryption: false,
          updateMetadata: false,
          throwOnInvalidObject: true,
        });
        if (pdf.isEncrypted || pdf.getPageCount() < 1) throw new Error();
        // Resolve page dictionaries as well as the cross-reference/object structure.
        for (const page of pdf.getPages()) {
          const size = page.getSize();
          if (
            !Number.isFinite(size.width) ||
            !Number.isFinite(size.height) ||
            size.width <= 0 ||
            size.height <= 0
          )
            throw new Error();
        }
        return { buffer, extension: "pdf", mediaType: "application/pdf" };
      }
      const image = sharp(buffer, {
        failOn: "warning",
        limitInputPixels: 40_000_000,
        animated: false,
      });
      const metadata = await image.metadata();
      if (
        !metadata.format ||
        !["png", "jpeg", "webp"].includes(metadata.format) ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > 16384 ||
        metadata.height > 16384 ||
        (metadata.pages ?? 1) !== 1
      )
        throw new Error();
      const extension = metadata.format as "png" | "jpeg" | "webp";
      // Decode and re-encode to reject corrupt images and remove unrelated metadata/payload.
      const normalized = await image.rotate().toFormat(extension).toBuffer();
      if (normalized.length > max) throw new Error();
      return { buffer: normalized, extension, mediaType: `image/${extension}` };
    } catch {
      throw new EventError("INVALID_FILE");
    }
  }
  async function uploadAsset(
    user: AuthUser,
    purpose: AssetPurpose,
    buffer: Buffer,
    originalName: string,
  ) {
    if (!["cover", "screenshot", "document"].includes(purpose))
      throw new EventError("INVALID_FILE");
    await assertCanEdit(user);
    const content = await validateContent(purpose, buffer);
    const original = nameFor(originalName, content.extension);
    return serializeDatabaseWrite(async () => {
      const db = await getDb();
      await assertCanEdit(user, db);
      const storageName = `${randomUUID()}.${content.extension}`;
      const target = storagePath(storageName);
      await mkdir(uploadDirectory(), { recursive: true });
      await writeFile(target, content.buffer, { flag: "wx", mode: 0o600 });
      try {
        return await db.transaction(async (tx) => {
          await assertCanEdit(user, tx);
          const max =
            purpose === "document"
              ? boundService.config.fileRules.documentMaxBytes
              : boundService.config.fileRules.imageMaxBytes;
          if (content.buffer.length > max) throw new EventError("INVALID_FILE");
          const [asset] = await tx
            .insert(eventAssets)
            .values({
              id: randomUUID(),
              eventId: eventConfig.id,
              userId: user.id,
              purpose,
              originalName: original,
              storageName,
              mediaType: content.mediaType,
              size: content.buffer.length,
              createdAt: new Date(),
            })
            .returning();
          return assetDto(asset);
        });
      } catch (error) {
        await unlink(target).catch(() => undefined);
        throw error;
      }
    });
  }
  async function readAsset(user: AuthUser, id: string) {
    if (!eventConfig.published && !(await isReviewer(user)))
      throw new EventError("NOT_FOUND");
    validateAssetId(id);
    const db = await getDb();
    const [asset] = await db
      .select()
      .from(eventAssets)
      .where(
        and(eq(eventAssets.eventId, eventConfig.id), eq(eventAssets.id, id)),
      )
      .limit(1);
    if (!asset) throw new EventError("NOT_FOUND");
    if (asset.userId !== user.id) {
      if (!(await isReviewer(user))) throw new EventError("FORBIDDEN");
      const rows = await db
        .select({ official: eventMaterials.official })
        .from(eventMaterials)
        .where(
          and(
            eq(eventMaterials.eventId, eventConfig.id),
            eq(eventMaterials.userId, asset.userId),
          ),
        );
      if (
        !rows.some((row) => materialReferences(row.official).includes(asset.id))
      )
        throw new EventError("FORBIDDEN");
    }
    try {
      return {
        buffer: await readFile(storagePath(asset.storageName)),
        mediaType: asset.mediaType,
        originalName: asset.originalName,
        purpose: asset.purpose,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new EventError("NOT_FOUND");
      throw error;
    }
  }
  async function referencedIds() {
    const rows = await (
      await getDb()
    )
      .select({
        official: eventMaterials.official,
        draft: eventMaterials.draft,
      })
      .from(eventMaterials);
    return new Set(
      rows.flatMap((row) => [
        ...materialReferences(row.official),
        ...materialReferences(row.draft),
      ]),
    );
  }
  async function removeAsset(asset: typeof eventAssets.$inferSelect) {
    try {
      await unlink(storagePath(asset.storageName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await (
      await getDb()
    ).transaction(async (tx) => {
      await tx.delete(eventAssets).where(eq(eventAssets.id, asset.id));
    });
  }
  /** Internal helper: caller MUST hold serializeDatabaseWrite's lock. */
  async function cleanupReplacedAssets(user: AuthUser, previousIds: string[]) {
    if (!previousIds.length) return 0;
    const db = await getDb();
    const protectedIds = await referencedIds();
    const candidates = await db
      .select()
      .from(eventAssets)
      .where(
        and(
          eq(eventAssets.eventId, eventConfig.id),
          eq(eventAssets.userId, user.id),
          inArray(eventAssets.id, [...new Set(previousIds)]),
        ),
      );
    let removed = 0;
    for (const asset of candidates) {
      if (protectedIds.has(asset.id)) continue;
      await removeAsset(asset);
      removed++;
    }
    return removed;
  }
  async function cleanupOrphanFiles(
    olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000),
  ) {
    if (!(olderThan instanceof Date) || !Number.isFinite(olderThan.getTime()))
      throw new EventError("INVALID_INPUT");
    return serializeDatabaseWrite(async () => {
      const db = await getDb();
      const protectedIds = await referencedIds();
      const candidates = await db
        .select()
        .from(eventAssets)
        .where(lt(eventAssets.createdAt, olderThan));
      let removed = 0;
      for (const asset of candidates) {
        if (protectedIds.has(asset.id)) continue;
        await removeAsset(asset);
        removed++;
      }
      // Also remove old disk files left behind if the process stopped before inserting a row.
      const remaining = new Set(
        (
          await db
            .select({ storageName: eventAssets.storageName })
            .from(eventAssets)
        ).map((asset) => asset.storageName),
      );
      let names: string[];
      try {
        names = await readdir(uploadDirectory());
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return removed;
        throw error;
      }
      for (const name of names) {
        if (
          remaining.has(name) ||
          !/^[a-f0-9-]{36}\.(png|jpeg|webp|pdf)$/.test(name)
        )
          continue;
        const filename = storagePath(name);
        const details = await stat(filename);
        if (details.isFile() && details.mtime < olderThan) {
          await unlink(filename);
          removed++;
        }
      }
      return removed;
    });
  }

  return { uploadAsset, readAsset, cleanupReplacedAssets, cleanupOrphanFiles };
}
export function filesForEvent(eventId: string) {
  const config = getEventConfig(eventId);
  if (!config) throw new EventError("NOT_FOUND");
  return buildFiles(config);
}
export const {
  uploadAsset,
  readAsset,
  cleanupReplacedAssets,
  cleanupOrphanFiles,
} = buildFiles(eventConfig);
