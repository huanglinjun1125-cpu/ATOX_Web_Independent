import { closeDb, getDb } from "../src/lib/db";

async function main() {
  try {
    await getDb();
    console.log("Database migrations applied.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
