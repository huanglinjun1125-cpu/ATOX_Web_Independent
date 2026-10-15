# M012 活动公开内容页

范围：/events/malaysia-ai-mvp-2026，中英文长页、赛道说明、三天议程、FAQ、拟议日历及待确认意向入口。默认英文，沿用共享语言存储与导航。

接口：EventView；malaysiaCard；challengeTracks；proposedDays；eventFaq；eventCalendar；safeInterestUrl。内容来自用户提供的最新版简报；七个赛道和 22 个时段均为拟议安排。

数据：无数据库、无私有写 API、无分析追踪。interestUrl 默认为 null，确认表单及隐私责任后可配置 HTTPS 入口。官方报名、团队、材料服务尚未接入，不生成未确认的报名与提交窗口。

验证：时间转换、拟议日历、HTTPS 入口边界、英文页面语义结构，以及预览目录筛选与公共投影测试。浏览器适配与视觉验收需在支持浏览器的环境继续验证。
