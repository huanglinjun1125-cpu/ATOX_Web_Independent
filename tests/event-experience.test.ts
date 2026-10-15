import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "../src/components/language-provider";
import { EventView } from "../src/modules/event-experience/components/event-view";
import {
  malaysiaEvent,
  challengeTracks,
  proposedDays,
  eventCalendar,
  safeInterestUrl,
} from "../src/modules/event-experience/config";
import { eventRegistry } from "../src/modules/event-board/config";
import { previewProjects } from "../src/preview/catalog";

test("The proposed programme uses MYT, exact supplied sessions and no live registration definition", () => {
  assert.equal(
    new Date(malaysiaEvent.startsAt).toISOString(),
    "2026-12-04T11:00:00.000Z",
  );
  assert.equal(
    new Date(malaysiaEvent.endsAt).toISOString(),
    "2026-12-06T10:00:00.000Z",
  );
  assert.equal(
    proposedDays.reduce((n, d) => n + d.sessions.length, 0),
    22,
  );
  assert.equal(challengeTracks.length, 7);
  assert.equal(malaysiaEvent.status, "planning");
  assert.equal(malaysiaEvent.interestUrl, null);
  assert.equal(
    eventRegistry.some((e) => e.id === malaysiaEvent.id),
    false,
  );
});
test("Calendar dates are explicitly tentative and preserve each day's UTC offset", () => {
  const c = eventCalendar();
  assert.equal((c.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.equal((c.match(/STATUS:TENTATIVE/g) || []).length, 3);
  for (const s of [
    "DTSTART:20261204T110000Z",
    "DTEND:20261204T140000Z",
    "DTSTART:20261205T000000Z",
    "DTEND:20261205T090000Z",
    "DTSTART:20261206T000000Z",
    "DTEND:20261206T100000Z",
  ])
    assert.ok(c.includes(s), s);
});
test("An interest destination must be absolute HTTPS and must not contain credentials", () => {
  for (const v of [
    null,
    "",
    "javascript:alert(1)",
    "http://example.com",
    "//example.com",
  ])
    assert.equal(safeInterestUrl(v), null);
  const credentialled = new URL("https://example.com");
  credentialled.username = "fixture-user";
  credentialled.password = "fixture-test-value";
  assert.equal(safeInterestUrl(credentialled.href), null);
  assert.equal(
    safeInterestUrl("https://example.com/interest"),
    "https://example.com/interest",
  );
});
test("The English event page exposes accessible tab panels and truthful pending information", () => {
  const s = renderToStaticMarkup(
    createElement(LanguageProvider, { defaultLanguage: "en" }, createElement(EventView)),
  );
  assert.match(s, /Build AI/);
  assert.match(s, /ATOX × TAMAPUSC at APU/);
  assert.match(s, /venue pending approval/);
  assert.match(s, /Register Interest/);
  assert.doesNotMatch(s, /<form\b|WORQ|ATOX × APU/);
  assert.equal((s.match(/role="tab"/g) || []).length, 3);
  assert.equal((s.match(/role="tabpanel"/g) || []).length, 3);
  assert.equal((s.match(/<details>/g) || []).length, 7);
});
test("The static preview keeps catalogue search and pagination without exposing private records", () => {
  const all = previewProjects();
  assert.equal(all.pageSize, 9);
  assert.ok(all.total > 9);
  const next = previewProjects({ page: "2" });
  assert.ok(next.projects.length > 0);
  const filtered = previewProjects({ q: "Atlas" });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.projects[0].id, "idea-atlas");
  assert.equal("email" in filtered.projects[0], false);
});
