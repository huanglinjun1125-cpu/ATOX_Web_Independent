import type { EventDefinition } from "./contracts";
/** Demo content only. Replace this configuration with approved event information. */
export const demoEventConfig: EventDefinition = {
  id: "demo",
  published: true,
  recommended: true,
  startsAt: "2026-10-01T00:00:00+08:00",
  endsAt: "2027-01-01T00:00:00+08:00",
  theme: { zh: "从想法到作品", en: "From idea to project" },
  organizer: { zh: "创造者社区 · 演示", en: "Builders community · Demo" },
  cover: "/event-covers/demo.svg",
  target: "/events/demo",
  tags: [],
  demo: true,
  participantCenter: {
    minSize: 2,
    maxSize: 4,
    resources: [
      {
        title: { zh: "材料填写与提交", en: "Prepare your submission" },
        url: "/events/demo/materials",
      },
    ],
    faq: [
      {
        question: {
          zh: "组队后由谁提交材料？",
          en: "Who submits materials after joining a team?",
        },
        answer: {
          zh: "本期仍由每位选手个人提交；组队不影响已有报名和材料。",
          en: "Each participant submits individually. Team membership does not change your registration or materials.",
        },
      },
      {
        question: { zh: "如何加入团队？", en: "How do I join a team?" },
        answer: {
          zh: "先完成个人报名，在招募大厅发出申请，由队长审批后加入。",
          en: "Register for the event, apply in the team directory, and wait for the captain to approve.",
        },
      },
    ],
  },
  timeZone: "Asia/Shanghai",
  registrationOpensAt: "2026-10-01T00:00:00+08:00",
  registrationClosesAt: "2027-01-01T00:00:00+08:00",
  submissionOpensAt: "2026-10-01T00:00:00+08:00",
  submissionClosesAt: "2027-01-01T00:00:00+08:00",
  name: {
    zh: "创造者黑客松 · 演示活动",
    en: "Builders Hackathon · Demo Event",
  },
  introduction: {
    zh: "从一个想法开始，完成你的第一份项目提案。这是一场用于验证报名、材料提交与受理流程的演示活动。",
    en: "Start with an idea and build your first project proposal. This demo event lets you explore registration, submission, and review.",
  },
  location: { zh: "线上 · 演示环境", en: "Online · Demo environment" },
  tracks: [{ id: "open", name: { zh: "开放创新", en: "Open Innovation" } }],
  rules: {
    zh: [
      "个人报名，个人提交；报名成功即可提交材料。",
      "开放期内可以保存草稿；待审核或需补充时可重新提交。",
      "已处理材料及截止后的内容为只读。",
      "可自愿组队协作，每人每活动限一队；材料仍个人提交。本次不收取费用。",
    ],
    en: [
      "Individual registration and submission. Register to become eligible.",
      "Save drafts and resubmit pending or changes-requested work during the open period.",
      "Processed submissions and closed-period content are read-only.",
      "Optional teams: one team per participant per event. Materials are submitted individually. This demo is free.",
    ],
  },
  fileRules: {
    imageMaxBytes: 5 * 1024 * 1024,
    documentMaxBytes: 20 * 1024 * 1024,
    maxScreenshots: 6,
  },
};

export const upcomingEventConfig: EventDefinition = {
  ...structuredClone(demoEventConfig),
  id: "upcoming-demo",
  recommended: false,
  name: {
    zh: "创造者冬季黑客松 · 演示活动",
    en: "Builders Winter Hackathon · Demo Event",
  },
  theme: { zh: "共创下一种可能", en: "Build the next possibility" },
  startsAt: "2027-01-15T00:00:00+08:00",
  endsAt: "2027-01-16T00:00:00+08:00",
  cover: "/event-covers/upcoming-demo.svg",
  target: "/events/upcoming-demo",
  participantCenter: {
    ...structuredClone(demoEventConfig.participantCenter),
    resources: [
      {
        title: { zh: "材料填写与提交", en: "Prepare your submission" },
        url: "/events/upcoming-demo/materials",
      },
    ],
  },
};
export const pastEventConfig: EventDefinition = {
  ...structuredClone(demoEventConfig),
  id: "past-demo",
  recommended: false,
  name: {
    zh: "创造者秋季黑客松 · 演示活动",
    en: "Builders Autumn Hackathon · Demo Event",
  },
  theme: { zh: "创意的第一步", en: "The first step of an idea" },
  startsAt: "2026-09-20T00:00:00+08:00",
  endsAt: "2026-09-21T00:00:00+08:00",
  registrationOpensAt: "2026-08-01T00:00:00+08:00",
  registrationClosesAt: "2026-09-20T00:00:00+08:00",
  submissionOpensAt: "2026-08-01T00:00:00+08:00",
  submissionClosesAt: "2026-09-20T00:00:00+08:00",
  cover: "/event-covers/past-demo.svg",
  target: "/events/past-demo",
  participantCenter: {
    ...structuredClone(demoEventConfig.participantCenter),
    resources: [
      {
        title: { zh: "查看材料记录", en: "View submissions" },
        url: "/events/past-demo/materials",
      },
    ],
  },
};
export const eventRegistry: EventDefinition[] = [
  demoEventConfig,
  upcomingEventConfig,
  pastEventConfig,
];
export function isSafeEventTarget(target: string | null) {
  if (target === null) return true;
  if (typeof target !== "string" || /[\\\u0000-\u0020]/.test(target))
    return false;
  if (target.startsWith("/") && !target.startsWith("//")) {
    try {
      const decoded = decodeURIComponent(target);
      return !decoded.startsWith("//") && !/[\\\u0000-\u0020]/.test(decoded);
    } catch {
      return false;
    }
  }
  try {
    const parsed = new URL(target);
    return (
      parsed.protocol === "https:" &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}
export function validateEventRegistry(
  registry: EventDefinition[] = eventRegistry,
) {
  if (
    registry.filter((event) => event.published && event.recommended).length > 1
  )
    throw new Error("Only one published recommended event is allowed");
  const ids = new Set<string>();
  for (const event of registry) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.id) ||
      ids.has(event.id) ||
      !isSafeEventTarget(event.target)
    )
      throw new Error("Invalid event registry");
    ids.add(event.id);
    for (const [start, end] of [
      [event.startsAt, event.endsAt],
      [event.registrationOpensAt, event.registrationClosesAt],
      [event.submissionOpensAt, event.submissionClosesAt],
    ])
      if (
        !Number.isFinite(Date.parse(start)) ||
        !Number.isFinite(Date.parse(end)) ||
        Date.parse(start) >= Date.parse(end)
      )
        throw new Error("Invalid event dates");
    new Intl.DateTimeFormat("en", { timeZone: event.timeZone });
  }
}
export function getEventConfig(id: string): EventDefinition | null {
  validateEventRegistry();
  return (
    eventRegistry.find((event) => event.id === id && event.published) ?? null
  );
}
validateEventRegistry();
