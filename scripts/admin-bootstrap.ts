import { userInfo } from "node:os";
import { bootstrapAdministrator } from "../src/modules/admin/service";
import { closeDb } from "../src/lib/db";
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--email") {
    console.error(
      "Usage: npm run admin:bootstrap -- --email registered@example.com",
    );
    process.exitCode = 1;
    return;
  }
  try {
    const administrator = await bootstrapAdministrator(
      args[1],
      userInfo().username,
    );
    console.log(
      `Administrator binding: ${administrator.email} (${administrator.role}, ${administrator.enabled ? "enabled" : "disabled"}).`,
    );
  } finally {
    await closeDb();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "INTERNAL_ERROR");
  process.exitCode = 1;
});
