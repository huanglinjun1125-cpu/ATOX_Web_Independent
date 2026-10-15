import type { BoardCardDto, Localized } from "../event-board/contracts";

/** Latest supplied brief dated 12 October 2026. All programme elements are proposed. */
export const EVENT_PATH = "/events/malaysia-ai-mvp-2026";
export const malaysiaEvent = {
  id: "malaysia-ai-mvp-2026",
  name: "ATOX × TAMAPUSC Malaysia AI & MVP Hackathon 2026",
  collaboration: "ATOX × TAMAPUSC at APU",
  timeZone: "Asia/Kuala_Lumpur",
  timeZoneLabel: "MYT / UTC+8",
  startsAt: "2026-12-04T19:00:00+08:00",
  endsAt: "2026-12-06T18:00:00+08:00",
  interestUrl: null as string | null,
  contactEmail: null as string | null,
  status: "planning" as const,
  participantEstimate: "120–150",
  venueConfirmed: false,
};

export function safeInterestUrl(value: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}

export const malaysiaCard: BoardCardDto = {
  id: malaysiaEvent.id,
  name: {
    zh: "ATOX × TAMAPUSC 马来西亚 AI & MVP 黑客松 2026",
    en: malaysiaEvent.name,
  },
  theme: { zh: "让 AI 创造真实价值", en: "Build AI That Matters" },
  introduction: {
    zh: "三天混合模式：周五线上启动，周六拟在 APU 协作开发，周日混合模式决赛。活动筹备中。",
    en: "A proposed three-day hybrid build sprint: online kick-off, a campus build day and hybrid finals. Planning in progress.",
  },
  organizer: { zh: "ATOX × TAMAPUSC at APU", en: malaysiaEvent.collaboration },
  location: {
    zh: "线上 + APU 校园，吉隆坡 · 场地待批准",
    en: "Online + APU Campus, Kuala Lumpur · venue pending approval",
  },
  cover: "/event-covers/malaysia-2026.svg",
  startsAt: malaysiaEvent.startsAt,
  endsAt: malaysiaEvent.endsAt,
  timeZone: malaysiaEvent.timeZone,
  target: EVENT_PATH,
  recommended: true,
  demo: false,
  year: 2026,
  stage: "upcoming",
  tags: [
    { zh: "筹备中", en: "Planning" },
    { zh: "混合模式", en: "Hybrid" },
  ],
};

type Track = {
  id: string;
  title: Localized;
  description: Localized;
  prompt: Localized;
};
export const challengeTracks: Track[] = [
  {
    id: "agents",
    title: {
      en: "Agentic AI & workflow automation",
      zh: "智能体 AI 与工作流程自动化",
    },
    description: {
      en: "Make repetitive work simpler, so people can focus on what matters.",
      zh: "让重复流程更简单，让人专注于更有价值的工作。",
    },
    prompt: {
      en: "Proposed area: explore a real workflow, identify where an AI agent can help, and build a small prototype that a user can test. Final challenge statements are pending review.",
      zh: "建议方向：找到真实的工作流程，明确智能体的介入点，构建用户可以测试的小型原型。正式赛题待审核。",
    },
  },
  {
    id: "trust",
    title: {
      en: "AI trust, safety & cybersecurity",
      zh: "AI 可信、安全与网络安全",
    },
    description: {
      en: "Build useful AI with privacy, security and responsible data use in mind.",
      zh: "把隐私、安全和负责任的数据使用带进 AI 设计。",
    },
    prompt: {
      en: "Proposed area: investigate safety, privacy or cybersecurity in an AI experience. Explain risks, document data use and demonstrate a practical improvement.",
      zh: "建议方向：关注 AI 体验中的安全、隐私或网络安全，说明风险、记录数据使用方式，并演示可行的改进。",
    },
  },
  {
    id: "campus",
    title: {
      en: "Smart campus & the future of work",
      zh: "智慧校园、教育与未来工作",
    },
    description: {
      en: "Reimagine how we learn, collaborate and find our next opportunity.",
      zh: "重新思考学习、协作和寻找机会的方式。",
    },
    prompt: {
      en: "Proposed area: start with a specific learning, campus or workplace problem and test your idea with the people who experience it.",
      zh: "建议方向：从具体的学习、校园或工作问题出发，让真正遇到问题的人测试你的想法。",
    },
  },
  {
    id: "climate",
    title: { en: "Climate & circular economy", zh: "气候韧性、能源与循环经济" },
    description: {
      en: "Explore more resourceful ways to use energy, materials and information.",
      zh: "探索更有效的能源、材料和信息利用方式。",
    },
    prompt: {
      en: "Proposed area: explore climate resilience, energy efficiency or circular use of resources. Be clear about the data and assumptions behind your prototype.",
      zh: "建议方向：探索气候韧性、能源效率或资源循环利用，清楚说明原型所依赖的数据和假设。",
    },
  },
  {
    id: "fintech",
    title: {
      en: "Inclusive fintech & SME productivity",
      zh: "普惠金融与中小企业生产力",
    },
    description: {
      en: "Create practical tools that help smaller businesses and communities.",
      zh: "为小型企业和社区创造实用的工具。",
    },
    prompt: {
      en: "Proposed area: identify a real task faced by a small business or an underserved user, and build a prototype that makes the task easier to complete.",
      zh: "建议方向：识别小型企业或服务不足群体的真实任务，搭建让任务更容易完成的原型。",
    },
  },
  {
    id: "wellbeing",
    title: {
      en: "Health, wellbeing & accessibility",
      zh: "健康、福祉与无障碍",
    },
    description: {
      en: "Design experiences that more people can understand and use.",
      zh: "设计更多人能够理解和使用的体验。",
    },
    prompt: {
      en: "Proposed area: improve access to information or everyday support. Define your intended users and be transparent about the prototype’s limitations.",
      zh: "建议方向：改善信息获取或日常支持，明确目标用户，并如实说明原型的局限。",
    },
  },
  {
    id: "tourism",
    title: {
      en: "Smart tourism & Malaysian culture",
      zh: "智慧旅游与马来西亚文化",
    },
    description: {
      en: "Help people discover places, stories and cultural experiences.",
      zh: "帮助人们发现地方、故事与文化体验。",
    },
    prompt: {
      en: "Proposed area: explore smart tourism, culture or Visit Malaysia experiences through a real user problem. Test how your prototype helps people discover and navigate.",
      zh: "建议方向：围绕真实用户问题探索智慧旅游、文化或 Visit Malaysia 体验，并测试原型如何帮助发现与导航。",
    },
  },
];

export const proposedDays = [
  {
    date: "04",
    label: "FRI / DEC",
    mode: { en: "ONLINE FIRST", zh: "线上启动" },
    title: { en: "Connect.", zh: "相遇。" },
    subtitle: {
      en: "Find your team. Frame your problem.",
      zh: "找到队友，明确问题。",
    },
    time: "19:00–22:00",
    description: {
      en: "Start online with the evening briefing, team matching and early idea validation.",
      zh: "通过晚间活动说明、组队匹配与创意验证，线上开启旅程。",
    },
    sessions: [
      {
        time: "19:00–19:20",
        title: {
          en: "Welcome, organisers & rules",
          zh: "欢迎、主办方介绍与规则",
        },
      },
      {
        time: "19:20–19:50",
        title: {
          en: "Challenges & judging criteria",
          zh: "赛题说明与评审标准",
        },
      },
      {
        time: "19:50–20:20",
        title: {
          en: "Team formation & participant matching",
          zh: "组队与参与者匹配",
        },
      },
      {
        time: "20:20–21:00",
        title: {
          en: "Problem framing, AI safety & MVP scoping",
          zh: "问题定义、AI 安全与 MVP 范围",
        },
      },
      {
        time: "21:00–21:40",
        title: {
          en: "Mentor rooms & idea validation",
          zh: "导师辅导与创意验证",
        },
      },
      {
        time: "21:40–22:00",
        title: {
          en: "Checkpoint & Saturday preparation",
          zh: "阶段检查与周六准备",
        },
      },
    ],
  },
  {
    date: "05",
    label: "SAT / DEC",
    mode: { en: "APU CAMPUS · PROPOSED", zh: "APU 校园 · 拟议" },
    title: { en: "Build.", zh: "共创。" },
    subtitle: {
      en: "Make it real. Test it with people.",
      zh: "做出原型，交给用户。",
    },
    time: "08:00–17:00",
    description: {
      en: "Work side by side, meet mentors and put your first prototype in front of users.",
      zh: "并肩开发，听取导师反馈，让第一版原型接受用户测试。",
    },
    sessions: [
      {
        time: "08:00–09:00",
        title: {
          en: "Registration, breakfast & team check-in",
          zh: "签到、早餐与团队确认",
        },
      },
      {
        time: "09:00–09:20",
        title: { en: "Opening & campus welcome", zh: "开幕与校园欢迎" },
      },
      {
        time: "09:20–10:00",
        title: {
          en: "Technical briefing & responsible AI",
          zh: "技术说明与负责任 AI",
        },
      },
      {
        time: "10:00–12:30",
        title: {
          en: "Build sprint 1 & mentor clinics",
          zh: "开发冲刺一与导师门诊",
        },
      },
      {
        time: "12:30–13:30",
        title: { en: "Lunch & networking", zh: "午餐与交流" },
      },
      {
        time: "13:30–15:30",
        title: {
          en: "Build sprint 2 & user testing",
          zh: "开发冲刺二与用户测试",
        },
      },
      {
        time: "15:30–16:15",
        title: {
          en: "Product, business & storytelling clinic",
          zh: "产品、商业与故事表达辅导",
        },
      },
      {
        time: "16:15–17:00",
        title: {
          en: "Midpoint demos, feedback & next steps",
          zh: "中期演示、反馈与后续开发计划",
        },
      },
    ],
  },
  {
    date: "06",
    label: "SUN / DEC",
    mode: { en: "HYBRID FINALS · PROPOSED", zh: "混合模式决赛 · 拟议" },
    title: { en: "Show.", zh: "呈现。" },
    subtitle: {
      en: "Demo what works. Share what’s next.",
      zh: "演示成果，分享下一步。",
    },
    time: "08:00–18:00",
    description: {
      en: "Refine your MVP, present your work and take the next step with your team.",
      zh: "完善 MVP，展示团队作品，并明确项目的下一步。",
    },
    sessions: [
      {
        time: "08:00–09:00",
        title: { en: "Re-entry & technical check", zh: "入场与技术检查" },
      },
      {
        time: "09:00–11:30",
        title: { en: "Final build sprint", zh: "最终开发冲刺" },
      },
      {
        time: "11:30–12:30",
        title: {
          en: "Submission quality check & lunch",
          zh: "提交质量检查与午餐",
        },
      },
      {
        time: "12:30–14:00",
        title: { en: "Preliminary judging in classrooms", zh: "教室初审" },
      },
      {
        time: "14:00–14:30",
        title: { en: "Finalist preparation", zh: "决赛团队准备" },
      },
      {
        time: "14:30–16:30",
        title: {
          en: "Auditorium finals: pitch, demo & Q&A",
          zh: "礼堂决赛：路演、演示与问答",
        },
      },
      {
        time: "16:30–17:15",
        title: {
          en: "Judges’ deliberation & community showcase",
          zh: "评委讨论与社区成果展示",
        },
      },
      {
        time: "17:15–18:00",
        title: {
          en: "Awards, closing & next-step opportunities",
          zh: "颁奖、闭幕与后续机会介绍",
        },
      },
    ],
  },
] as const;

export const eventFaq = [
  {
    q: { en: "Who is this for?", zh: "谁适合参加？" },
    a: {
      en: "University students, developers, designers, founders and problem-solvers from APU and the wider Malaysian ecosystem. Multidisciplinary teams are encouraged.",
      zh: "面向 APU 及马来西亚创新生态中的大学生、开发者、设计师、创业者和问题解决者，鼓励跨专业协作。",
    },
  },
  {
    q: { en: "Can I participate remotely?", zh: "可以远程参加吗？" },
    a: {
      en: "Friday is online-first. Teams unable to attend physically may submit remotely and pitch online, subject to technical confirmation. Every team needs at least one live representative at checkpoints.",
      zh: "周五以线上为主。无法到场的团队可远程提交并在线路演，但须提前完成技术确认。每支团队至少一名代表须实时参加阶段检查。",
    },
  },
  {
    q: {
      en: "What if I have classes on Friday?",
      zh: "周五有课或工作怎么办？",
    },
    a: {
      en: "Join the live evening kick-off, or review the recorded briefing and complete a short team check-in before Saturday morning.",
      zh: "可以参加晚间直播，也可以观看录制说明，并在周六早上前完成简短团队签到。",
    },
  },
  {
    q: { en: "What will we build and submit?", zh: "要做什么，提交什么？" },
    a: {
      en: "A working, testable MVP that begins with a real user problem and documents responsible use of data and AI. Final submission requirements and the platform will be announced.",
      zh: "从真实用户问题出发，交付可以运行和测试的 MVP，并记录负责任的数据与 AI 使用方式。正式提交要求和平台待公布。",
    },
  },
  {
    q: {
      en: "How will online and on-site teams be judged?",
      zh: "线上和线下团队如何保证公平？",
    },
    a: {
      en: "All teams use the same deadlines, judging rubric and submission format. Core briefings should have recordings and written materials. The final judging rubric is pending confirmation.",
      zh: "所有团队使用相同截止时间、评审标准和提交格式。核心说明内容将提供录制与文字资料，最终评分规则待确认。",
    },
  },
  {
    q: {
      en: "Are the venue, mentors and prizes confirmed?",
      zh: "场地、导师和奖项是否已确认？",
    },
    a: {
      en: "Planning is in progress. The APU campus venue is subject to internal approval and booking. Mentors, judges, partners, prizes and sponsor benefits will be announced after written confirmation.",
      zh: "活动筹备中。APU 校园场地须经内部批准和预订。导师、评委、合作伙伴、奖项和赞助权益将在书面确认后公布。",
    },
  },
  {
    q: { en: "Is registration open?", zh: "现在可以正式报名吗？" },
    a: {
      en: "Formal registration is not open yet. Interest registration will be linked here after the registration owner, official form and privacy notice are confirmed.",
      zh: "正式报名尚未开放。意向登记负责人、正式表单和隐私说明确认后，将在这里提供入口。",
    },
  },
] as const;

export function eventCalendar() {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ATOX//Malaysia AI MVP Hackathon//EN",
    "CALSCALE:GREGORIAN",
    ...proposedDays.flatMap((d, i) => [
      "BEGIN:VEVENT",
      `UID:atox-malaysia-2026-${i + 1}@atox.local`,
      "DTSTAMP:20261012T000000Z",
      `DTSTART:2026120${i + 4}T${i === 0 ? "110000" : "000000"}Z`,
      `DTEND:2026120${i + 4}T${i === 0 ? "140000" : i === 1 ? "090000" : "100000"}Z`,
      `SUMMARY:Proposed ATOX x TAMAPUSC - ${d.title.en}`,
      `LOCATION:${i === 0 ? "Online" : "APU campus - subject to approval"}`,
      "STATUS:TENTATIVE",
      "DESCRIPTION:Programme proposed. All campus activities subject to approval and booking.",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
