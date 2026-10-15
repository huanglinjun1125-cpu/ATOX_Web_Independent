import { writeFile } from "node:fs/promises";
import { homepageConfig } from "../src/modules/homepage/config";
const c = structuredClone(homepageConfig) as unknown as {
  brand: string;
  metadata: Record<string, string>;
  copy: { zh: Record<string, unknown>; en: Record<string, unknown> };
};
c.brand = "ATOX";
c.metadata = {
  title: "ATOX 爱拓无限 — 连接青年与 AI 创造",
  description:
    "通过技术、产品与全球社区，让想法走向实践。探索 ATOX 的活动与创造者项目。",
  projectsTitle: "创造者项目 — ATOX",
  projectsDescription:
    "探索 ATOX 创造者项目展区。当前目录包含清晰标注的演示作品。",
};
Object.assign(c.copy.zh, {
  demo: "ATOX / AI 青年生态品牌",
  homeLabel: "ATOX 首页",
  heroEyebrow: "连接青年，连接新的可能。",
  heroLineOne: "连接青年，",
  heroLineTwo: "让创造",
  heroAccent: "无限发生。",
  heroDescription:
    "以技术、产品与全球社区，连接不同视角，让有意义的想法走向实践。",
  heroNote: "让好奇心走向实践。",
  aboutTitle: "因为相信可能，\n所以连接彼此。",
  aboutLead: "ATOX 爱拓无限，一个 AI 青年生态品牌。",
  aboutBody:
    "我们连接开发者、设计师、产品思考者与愿意动手尝试的人，以技术和产品为起点，让不同背景的青年在共同创造中相遇。",
  aboutClosing:
    "通过技术、产品和全球社区，帮助人类生活得更好。从提出一个问题，到完成第一份原型，让探索拥有可以继续生长的空间。",
  programsTitle: "把新的想法，\n变成下一步行动。",
  programsIntro: "以活动连接人，以共创推动实践，以作品记录那些正在发生的可能。",
  exploreEyebrow: "04 / 继续探索",
  exploreTitle: "找到同行者，\n也找到下一步。",
  eventCardTag: "EVENTS / 活动",
  eventCardTitle: "下一场，\n一起创造。",
  eventCardBody:
    "发现主题、时间与参与方式。马来西亚活动正在筹备；其他目录条目为功能演示活动。",
  projectCardTag: "PROJECTS / 创造者项目",
  projectCardTitle: "看见作品，\n看见新的可能。",
  projectCardBody:
    "按分类与活动探索创作灵感。当前项目展区为明确标注的原创演示作品，真实投稿尚未开放。",
  footerTagline: "AI 青年生态品牌。\n以连接，让创造无限发生。",
  footerNote: "爱拓无限 / ATOX · 活动状态以正式公布为准",
});
Object.assign(c.copy.en, {
  demo: "ATOX / AI YOUTH ECOSYSTEM",
  homeLabel: "ATOX home",
  heroEyebrow: "CONNECT THE NEXT.",
  heroLineOne: "Human ideas.",
  heroLineTwo: "Real",
  heroAccent: "possibilities.",
  heroDescription:
    "Through technology, products and a global community, we connect perspectives and help meaningful ideas move into practice.",
  heroNote: "A place for curiosity to become creation.",
  aboutTitle: "Connected by ideas.\nOpen to possibility.",
  aboutLead: "ATOX is an AI youth ecosystem brand.",
  aboutBody:
    "We connect developers, designers, product thinkers and people ready to try. Technology and products give different perspectives a shared starting point for creation.",
  aboutClosing:
    "A better life for humanity, through technology, products, and a global community. From a thoughtful question to a first prototype, we make room for ideas to develop.",
  programsTitle: "Move from inspiration\nto a first real step.",
  programsIntro:
    "Connect through events. Learn through co-creation. Share the work and the possibilities that follow.",
  exploreEyebrow: "04 / KEEP EXPLORING",
  exploreTitle: "Find your people.\nFind your next step.",
  eventCardTag: "EVENTS / EXPLORE",
  eventCardTitle: "Your next reason\nto build together.",
  eventCardBody:
    "Explore themes, dates and participation options. The Malaysia event is in planning; other catalogue entries demonstrate platform functionality.",
  projectCardTag: "PROJECTS / DISCOVER",
  projectCardTitle: "Work worth seeing.\nIdeas worth sharing.",
  projectCardBody:
    "Discover creative possibilities by category and event. Current projects are original, clearly labelled demonstrations; real submissions are not open yet.",
  footerTagline: "An AI youth ecosystem.\nConnection into creation.",
  footerNote: "ATOX · Event information subject to official confirmation",
});
writeFile(
  "src/modules/homepage/config.ts",
  "/** ATOX brand copy. Programme content remains separately configured. */\nexport const homepageConfig = " +
    JSON.stringify(c, null, 2) +
    " as const;\n",
).then(() =>
  console.log(
    "Updated bilingual ATOX brand copy while preserving the content editor contract.",
  ),
);
