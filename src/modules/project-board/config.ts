import type { LocalizedText, ProjectCard, ProjectCategory } from "./contracts";

export const categories: { id: ProjectCategory; name: LocalizedText }[] = [
  { id: "software", name: { zh: "软件", en: "Software" } },
  { id: "hardware", name: { zh: "硬件", en: "Hardware" } },
  { id: "game", name: { zh: "游戏", en: "Games" } },
  { id: "aigc", name: { zh: "AIGC 影像", en: "AIGC & film" } },
  { id: "other", name: { zh: "其他", en: "Other" } },
];
export type ProjectDefinition = Omit<ProjectCard, "event"> & {
  published: boolean;
};
const text = (zh: string, en: string): LocalizedText => ({ zh, en });
function demo(
  id: string,
  name: LocalizedText,
  introduction: LocalizedText,
  category: ProjectCategory,
  eventId: string | null,
  tags: LocalizedText[],
  day: number,
  artwork: string,
): ProjectDefinition {
  return {
    id,
    name,
    introduction,
    category,
    eventId,
    tags,
    creator: text("好奇心工坊 · 示例创作者", "Curiosity studio · demo creator"),
    cover: artwork ? `/projects/${artwork}.svg` : "",
    publishedAt: `2026-10-${String(day).padStart(2, "0")}T08:00:00+08:00`,
    published: true,
    demo: true,
  };
}
export const projectRegistry: ProjectDefinition[] = [
  demo(
    "idea-atlas",
    text("灵感地图", "Idea Atlas"),
    text(
      "把散落的灵感连接起来，沿着好奇心寻找下一个值得动手的问题。",
      "Connect scattered ideas and follow your curiosity toward the next question worth building for.",
    ),
    "software",
    "demo",
    [
      text("知识连接", "Knowledge"),
      text("可视化", "Visualization"),
      text("探索", "Discovery"),
      text("创作工具", "Creative tools"),
    ],
    9,
    "atlas",
  ),
  demo(
    "pocket-garden",
    text("口袋花园", "Pocket Garden"),
    text(
      "一盏会回应环境的小灯，让桌面上的植物与日常生活轻轻对话。",
      "A small light that responds to its surroundings, connecting a desktop plant with everyday life.",
    ),
    "hardware",
    null,
    [text("环境感知", "Sensors"), text("日常设计", "Everyday design")],
    9,
    "garden",
  ),
  demo(
    "echo-island",
    text("回声岛", "Echo Island"),
    text(
      "用声音探索一座看不见的岛屿，每一次倾听都是一条新的路径。",
      "Explore an unseen island through sound. Every moment of listening opens another path.",
    ),
    "game",
    "demo",
    [text("声音", "Sound"), text("探索游戏", "Exploration")],
    8,
    "echo",
  ),
  demo(
    "light-notes",
    text("光的手记", "Notes of Light"),
    text(
      "用抽象影像记录一天的光线，让时间变成一段可以观看的诗。",
      "Record a day of light as abstract moving images, turning time into a visual poem.",
    ),
    "aigc",
    "past-demo",
    [text("生成影像", "Generative film"), text("光影", "Light")],
    7,
    "light",
  ),
  demo(
    "shared-table",
    text("共创一桌", "Shared Table"),
    text(
      "一套帮助陌生人交换想法的桌面卡片，从一个好问题开始一场讨论。",
      "A set of tabletop prompts for exchanging ideas with new people. Start a conversation with one good question.",
    ),
    "other",
    null,
    [text("共创", "Co-creation"), text("交流", "Conversation")],
    6,
    "table",
  ),
  demo(
    "quiet-clock",
    text("安静时钟", "Quiet Clock"),
    text(
      "用缓慢变化的色彩提示时间，为专注和休息留出温和的节奏。",
      "Mark time with gradually shifting colors, giving focus and rest a gentler rhythm.",
    ),
    "hardware",
    "upcoming-demo",
    [text("专注", "Focus"), text("交互设计", "Interaction")],
    5,
    "clock",
  ),
  demo(
    "open-sketch",
    text("开放草图", "Open Sketch"),
    text(
      "让尚未成形的方案先被看见，在共同标记与讨论中逐渐清晰。",
      "Make an unfinished idea visible and develop it through shared annotations and conversation.",
    ),
    "software",
    null,
    [text("协作", "Collaboration"), text("原型", "Prototyping")],
    4,
    "sketch",
  ),
  demo(
    "tiny-orbits",
    text("小小轨道", "Tiny Orbits"),
    text(
      "通过调整星体的轨道解决谜题，体验平衡与变化之间的微妙关系。",
      "Solve puzzles by adjusting small celestial orbits and explore the relationship between balance and change.",
    ),
    "game",
    "upcoming-demo",
    [text("解谜", "Puzzle"), text("轨道", "Orbits")],
    3,
    "orbit",
  ),
  demo(
    "paper-weather",
    text("纸上天气", "Paper Weather"),
    text(
      "将天气印象变成纸张质感的动态画面，想象一份属于自己的气象日记。",
      "Turn impressions of weather into paper-textured moving images and imagine a personal weather diary.",
    ),
    "aigc",
    null,
    [text("纸张", "Paper"), text("影像实验", "Visual experiments")],
    2,
    "weather",
  ),
  demo(
    "neighborhood-kit",
    text("街角工具箱", "Neighborhood Kit"),
    text(
      "整理邻里间可以交换的小技能，让一次互助成为认识彼此的开始。",
      "Collect small skills neighbors can exchange and make mutual help a way to meet.",
    ),
    "other",
    "past-demo",
    [text("社区", "Community"), text("互助", "Mutual help")],
    1,
    "kit",
  ),
  demo(
    "trail-lines",
    text("漫游线索", "Trail Lines"),
    text(
      "用简单的路线记录城市漫步，把日常经过的地方变成观察的新起点。",
      "Trace a city walk and turn familiar places into new starting points for observation.",
    ),
    "software",
    "demo",
    [text("地图", "Maps"), text("城市观察", "Urban observation")],
    1,
    "trail",
  ),
  demo(
    "blank-canvas",
    text("未命名的可能", "Untitled Possibilities"),
    text(
      "从空白开始的一次创作实验：先留下问题，再寻找形式。这是一项尚未准备封面的演示项目。",
      "A creative experiment starting from a blank canvas: keep the question first, then find its form. This demo has no cover yet.",
    ),
    "other",
    null,
    [text("实验", "Experiment")],
    1,
    "",
  ),
];
