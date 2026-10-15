import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "../src/modules/auth/return-path";

test("Login return path accepts internal routes and rejects external or ambiguous URLs", () => {
  assert.equal(
    safeReturnPath("/events/demo/materials?tab=draft"),
    "/events/demo/materials?tab=draft",
  );
  for (const value of [
    undefined,
    ["/events/demo"],
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "/%5cevil.example",
    "/login",
    "/a/../login",
    "/api/auth/logout",
    "/%0aevil",
    "/%zz",
  ]) {
    assert.equal(safeReturnPath(value), "/account", String(value));
  }
});
