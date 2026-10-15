/** Only demonstration data; independent from M002. Money is in CNY fen. */
export const ticketingConfig = {
  event: {
    id: "ticketing-demo",
    name: {
      zh: "创造者开放日 · 演示活动",
      en: "Builders Open Day · Demo Event",
    },
    introduction: {
      zh: "探索创意，与创造者交流。这是用于验证选票、结算与模拟支付的演示活动；门票不代表参赛资格。",
      en: "Explore ideas and meet builders. A demo of ticket selection, checkout and simulated payment. Admission does not grant competition eligibility.",
    },
    organizer: { zh: "演示主办方", en: "Demo organizer" },
    location: {
      zh: "线上演示 · 无实际场地",
      en: "Online demo · No physical venue",
    },
    startsAt: "2027-01-10T14:00:00+08:00",
    endsAt: "2027-01-10T18:00:00+08:00",
    timeZone: "Asia/Shanghai",
    policy: {
      zh: "演示退款政策：本模块不收取真实款项，也不办理真实退款。正式活动上线前将公布实际退款规则。",
      en: "Demo refund policy: no real money is collected and no real refunds are processed. Actual terms will be published before a real event.",
    },
    contact: {
      zh: "演示环境暂无运营联系方式；正式活动上线前补齐。",
      en: "No operating contact is configured for this demo. Contact details are required before launch.",
    },
  },
  policyVersion: "demo-policy-v1",
  currency: "CNY",
  maxPerAccount: 5,
  reservationMinutes: 15,
  tickets: [
    {
      id: "early",
      name: { zh: "早鸟票", en: "Early bird" },
      unitAmount: 4900,
      inventory: 100,
      enabled: true,
      opensAt: "2026-10-01T00:00:00+08:00",
      closesAt: "2026-11-01T00:00:00+08:00",
    },
    {
      id: "standard",
      name: { zh: "标准票", en: "Standard ticket" },
      unitAmount: 9900,
      inventory: 100,
      enabled: true,
      opensAt: "2026-10-01T00:00:00+08:00",
      closesAt: "2027-01-01T00:00:00+08:00",
    },
  ],
  questions: {
    sources: [
      { id: "community", label: { zh: "社区", en: "Community" } },
      { id: "friend", label: { zh: "朋友推荐", en: "A friend" } },
      { id: "other", label: { zh: "其他", en: "Other" } },
    ],
    purposes: [
      { id: "learn", label: { zh: "学习交流", en: "Learn" } },
      { id: "network", label: { zh: "结识伙伴", en: "Meet people" } },
      { id: "explore", label: { zh: "了解项目", en: "Explore projects" } },
    ],
  },
};
