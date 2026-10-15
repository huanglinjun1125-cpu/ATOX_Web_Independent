import { maintainOrders } from "../src/modules/ticketing/service";
import { closeDb } from "../src/lib/db";
async function main() {
  try {
    console.log(await maintainOrders());
  } finally {
    await closeDb();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
