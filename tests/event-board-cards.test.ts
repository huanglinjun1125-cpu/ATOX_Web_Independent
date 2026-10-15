import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "../src/components/language-provider";
import { EventCard } from "../src/modules/event-board/components/board-view";
import { demoEventConfig } from "../src/modules/event-board/config";
import type { BoardCardDto } from "../src/modules/event-board/contracts";

function card(overrides: Partial<BoardCardDto> = {}) {
  const item: BoardCardDto = {
    ...demoEventConfig,
    year: 2026,
    stage: "ongoing",
    ...overrides,
  };
  return renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(EventCard, { item })),
  );
}

test("Cards render safe internal/external links, disable absent targets, and escape long text", () => {
  const internal = card();
  assert.match(internal, /href="\/events\/demo"/);
  assert.doesNotMatch(internal, /target="_blank"/);
  const external = card({ target: "https://example.com/event" });
  assert.match(external, /target="_blank"/);
  assert.match(external, /rel="noopener noreferrer"/);
  assert.match(external, /前往外部活动页面/);
  const absent = card({ target: null, cover: "" });
  assert.doesNotMatch(absent, /<a\b|<img\b/);
  assert.match(absent, /aria-disabled="true"/);
  assert.match(absent, /即将开放/);
  assert.match(absent, /ATOX \/ 2026/);
  const malicious = card({
    target: "javascript:alert(1)",
    name: { zh: "<script>" + "长标题".repeat(80), en: "Long title" },
  });
  assert.doesNotMatch(malicious, /<script>|href="javascript:/);
  assert.match(malicious, /&lt;script&gt;/);
});
