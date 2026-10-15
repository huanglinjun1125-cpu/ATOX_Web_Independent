import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";

export { schema };

function createDatabase() {
  // Runtime data is not a build asset; keep it out of Next.js file tracing.
  const dataDirectory = path.resolve(
    /* turbopackIgnore: true */ process.env.DB_PATH || ".data/pglite",
  );
  mkdirSync(path.dirname(dataDirectory), { recursive: true });
  const client = new PGlite(dataDirectory);
  return { client, db: drizzle(client, { schema }) };
}

type Database = ReturnType<typeof createDatabase>["db"];
const globalDb = globalThis as typeof globalThis & {
  __hackathonDatabase?: Promise<Database>;
  __hackathonClient?: PGlite;
  __databaseWriteQueue?: Promise<unknown>;
};

/** Single-process PGlite writes share one queue across business modules and HMR.
 * Queue the complete transaction; never call recursively from a queued write.
 */
export async function serializeDatabaseWrite<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const result = (globalDb.__databaseWriteQueue ?? Promise.resolve()).then(
    operation,
    operation,
  );
  globalDb.__databaseWriteQueue = result.catch(() => undefined);
  return result;
}

export async function getDb(): Promise<Database> {
  if (!globalDb.__hackathonDatabase) {
    globalDb.__hackathonDatabase = (async () => {
      const { client, db } = createDatabase();
      globalDb.__hackathonClient = client;
      try {
        await migrate(db, { migrationsFolder: path.resolve("drizzle") });
        return db;
      } catch (error) {
        await client.close();
        delete globalDb.__hackathonClient;
        throw error;
      }
    })().catch((error) => {
      delete globalDb.__hackathonDatabase;
      throw error;
    });
  }
  return globalDb.__hackathonDatabase;
}

/** Call only after requests/transactions have stopped (tests and migration CLI). */
export async function closeDb(): Promise<void> {
  const initializing = globalDb.__hackathonDatabase;
  if (!initializing) return;
  try {
    await initializing;
    await globalDb.__hackathonClient?.close();
  } finally {
    delete globalDb.__hackathonDatabase;
    delete globalDb.__hackathonClient;
  }
}
