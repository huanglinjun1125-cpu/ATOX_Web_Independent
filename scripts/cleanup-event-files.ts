import { cleanupOrphanFiles } from "../src/modules/event-participation/files";
import { closeDb } from "../src/lib/db";

async function main() {
  try {
    console.log(`Removed ${await cleanupOrphanFiles()} orphan file(s).`);
  } finally {
    await closeDb();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
