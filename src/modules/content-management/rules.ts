import type { EventDefinition } from "../event-board/contracts";
import { validateEventRegistry } from "../event-board/config";
import { centerConfig } from "../participant-center/config";
import { HOME_TEXT_KEYS, type HomepageContent } from "./contracts";
export class ContentError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function contentId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 80 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  )
    throw new ContentError("INVALID_ID");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ContentError("INVALID_CONTENT");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 5000) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new ContentError("INVALID_CONTENT");
  return value.trim();
}
function localized(value: unknown, max = 5000) {
  const item = object(value);
  return { zh: text(item.zh, max), en: text(item.en, max) };
}
export function validateHomepage(value: unknown): HomepageContent {
  const input = object(value),
    fields = object(input.text),
    metadata = object(input.metadata);
  if (!Array.isArray(input.programs) || input.programs.length !== 3)
    throw new ContentError("INVALID_CONTENT");
  return {
    text: Object.fromEntries(
      HOME_TEXT_KEYS.map((key) => [key, localized(fields[key])]),
    ) as HomepageContent["text"],
    programs: input.programs.map((item) => {
      const row = object(item);
      return {
        title: localized(row.title, 200),
        subtitle: localized(row.subtitle, 200),
        body: localized(row.body),
      };
    }),
    metadata: {
      title: localized(metadata.title, 150),
      description: localized(metadata.description, 500),
    },
  };
}
export function validateEvent(
  value: unknown,
  id: string,
  previous?: EventDefinition,
): EventDefinition {
  const input = object(value);
  if (
    input.id !== id ||
    typeof input.recommended !== "boolean" ||
    typeof input.demo !== "boolean"
  )
    throw new ContentError("INVALID_CONTENT");
  const data = {
    ...structuredClone(previous ?? input),
    ...input,
  } as unknown as EventDefinition;
  data.id = contentId(id);
  // Public destinations, file limits and team behavior are system-owned in this version.
  data.target = `/events/${id}`;
  data.fileRules = previous?.fileRules ?? {
    imageMaxBytes: 5 * 1024 * 1024,
    documentMaxBytes: 20 * 1024 * 1024,
    maxScreenshots: 6,
  };
  data.participantCenter = previous?.participantCenter;
  for (const key of [
    "name",
    "theme",
    "introduction",
    "organizer",
    "location",
  ] as const)
    data[key] = localized(input[key], key === "introduction" ? 10000 : 300);
  data.cover = text(input.cover, 100);
  if (
    ![
      "/event-covers/demo.svg",
      "/event-covers/upcoming-demo.svg",
      "/event-covers/past-demo.svg",
    ].includes(data.cover)
  )
    throw new ContentError("INVALID_COVER");
  data.timeZone = text(input.timeZone, 80);
  for (const key of [
    "startsAt",
    "endsAt",
    "registrationOpensAt",
    "registrationClosesAt",
    "submissionOpensAt",
    "submissionClosesAt",
  ] as const) {
    const date = text(input[key], 40);
    if (
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(
        date,
      )
    )
      throw new ContentError("INVALID_DATES");
    data[key] = date;
  }
  if (
    !Array.isArray(input.tracks) ||
    input.tracks.length < 1 ||
    input.tracks.length > 20
  )
    throw new ContentError("INVALID_TRACKS");
  data.tracks = input.tracks.map((item) => {
    const row = object(item);
    return { id: contentId(row.id), name: localized(row.name, 200) };
  });
  if (new Set(data.tracks.map((track) => track.id)).size !== data.tracks.length)
    throw new ContentError("INVALID_TRACKS");
  const rules = object(input.rules);
  data.rules = { zh: [], en: [] };
  for (const language of ["zh", "en"] as const) {
    if (
      !Array.isArray(rules[language]) ||
      rules[language].length < 1 ||
      rules[language].length > 30
    )
      throw new ContentError("INVALID_CONTENT");
    data.rules[language] = rules[language].map((item) => text(item, 2000));
  }
  data.tags = previous?.tags ?? [];
  data.published = true;
  try {
    validateEventRegistry([data]);
    centerConfig(data);
  } catch {
    throw new ContentError("INVALID_DATES");
  }
  return data;
}
