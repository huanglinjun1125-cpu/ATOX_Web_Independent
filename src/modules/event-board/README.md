## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M004 活动展板与多活动接入

## 当前维护摘要（2026-10-10）

- 职责：公开活动目录、阶段／搜索筛选与参赛父级导航。
- 公共接口：server.ts 异步 getBoard/getEventConfig、client.ts、contracts.ts、rules.ts；GET /api/events 与页面共用规则。
- 依赖与配置：M010 发布核、M002 参赛契约、共享语言／导航、M001 显示身份；无独立变量，沿用 DB／认证配置。
- 验证：event-board.test.ts、event-board-cards.test.ts、content-management.test.ts；浏览器 event-board.spec.ts、content-management.spec.ts。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：config.ts 是静态默认注册表，运行公开来源是 M010 已发布 live；未发布／下架不展示，阶段不代表报名资格。旧同步配置／审核白名单描述属于历史；无本模块迁移。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

版本：1.0.0。公开活动展板是 M002 报名与材料流程的父级；本轮仅整合活动展板、M001 认证和 M002。M003 售票与模拟支付仍保持独立开发预览。

## 入口与配置

- `/events`：公开展板，中英文、推荐、搜索、年份与阶段交集筛选；URL 参数 `q`、`year`、`stage` 支持刷新、分享和前进后退。
- `/events/[eventId]`、`/register`、`/materials`：对应活动详情、个人报名、材料；`/review/events/[eventId]` 为受理人员入口。
- 原 `/events/demo` 及其全部 API 地址继续有效，数据保持原活动 ID，不迁移或复制用户。
- `config.ts` 的 `eventRegistry` 是活动展示与参赛配置唯一来源；`getEventConfig(id)` 仅解析已发布活动。未知、未发布活动的页面和接口为 404。
- 自有 SVG 封面位于 `public/event-covers/`；缺图回退统一图形。本站没有复制参考站素材或品牌。

三场内容均为演示活动，时区 Asia/Shanghai，起点包含、终点不包含：

| ID | 活动时间 | 报名／提交时间 |
| --- | --- | --- |
| demo | 2026-10-01 至 2027-01-01 | 原值：2026-10-01 至 2027-01-01 |
| upcoming-demo | 2027-01-15 至 2027-01-16 | 2026-10-01 至 2027-01-01 |
| past-demo | 2026-09-20 至 2026-09-21 | 2026-08-01 至 2026-09-20，已截止 |

活动阶段与报名／提交开放窗口独立，展板不显示推测的报名资格。默认不筛选时推荐一个有有效入口的未结束活动；多个已发布推荐配置会校验失败。站内地址同页打开，外链只允许 HTTPS 且明确标识、新标签带 `noopener noreferrer`；无目标地址显示即将开放。

## 公开接口和契约

服务端入口 `server.ts`：`getBoard(filters?)`、`getEventConfig(id)`；公开类型 `contracts.ts`：`BoardDto`、`BoardCardDto`、`BoardFilters`、`EventDefinition`。`rules.ts` 提供阶段、时区年份、筛选、排序和推荐规则，展板与 API 共用。

`GET /api/events?q=...&year=2027&stage=upcoming` 返回：

```ts
{ events: BoardCardDto[], serverNow: string }
```

卡片显式白名单包含 id、双语名称／主题／简介、封面、主办方、地点、活动时间、时区、目标、推荐、演示标识、标签、year 和 stage；不含报名人、材料、附件、订单、内部备注或参赛开放配置。无需登录，不缓存。q 最长 200 字，year 为四位年份或 all，stage 为 upcoming／ongoing／ended／all，非法条件返回 400 `INVALID_INPUT`。

年份为活动开始时间在活动时区中的年份。阶段为开始前 upcoming、开始至结束前 ongoing、结束起 ended。排序为进行中结束升序、即将开始开始升序、已结束结束降序，同值按 ID；搜索去除首尾空格、匹配双语名称及主题、不区分大小写，输入防抖 300ms。

## M002 接入与数据安全

`event-participation/server.ts` 新增 `forEvent(id)`，返回显式配置和当前活动绑定的报名／材料／受理服务；`filesForEvent(id)` 返回文件服务。原无活动参数的服务导出仍兼容 demo。浏览器 `createEventRequest(id)` 与 `EventProvider config` 绑定同一活动，默认空材料赛道来自当前活动。路由层不临时修改全局配置。

全部业务查询校验 eventId；文件还验证用户归属、用途和正式引用。受理人员沿用 `EVENT_REVIEWER_EMAILS`，只能处理当前活动正式材料；内部备注不下发参赛者。清理继续扫描所有活动正式／草稿引用。数据表、历史迁移、数据库连接、写队列和磁盘数据均复用，没有新增迁移、重置或数据复制。

无新增环境变量。沿用 M001 的本地邮箱和安全 next 参数、M002 的私有上传目录及受理白名单。维护前仍需停止同目录 PGlite 服务。生产邮箱登录仍按 M001 现有约束关闭；活动展板和公开详情不使用开发预览开关。

## 本地运行与留存

```powershell
npm install
# 首次配置：复制 .env.example 为 .env.local，并按根 README 设置服务端密钥
npm run dev
```

打开 http://localhost:3000/events。报名和材料需要通过已有邮箱登录；本地验证码在 `/dev/mail`。完整设计见 `docs/M004-DESIGN.md`，验收记录见 `docs/M004-VALIDATION.md`。

源码归档：`deliverables/M004-event-board-v1.0.0.zip`，包含可运行源码、配置示例、历史迁移、测试和说明，不含真实密钥、数据库、用户材料、邮件、依赖或构建产物。M001—M003 原归档保留。内容管理、项目画廊、团队、真实支付、评分及其全站整合继续留待后续。
## M010 兼容接入（2026-10-10）

活动运行注册表改读数据库发布源，server.getEventConfig 异步解析已发布配置；草稿及下架不进入公开看板。原同步配置查询仅保留静态兼容用途。M002／M007运行路由分别使用resolveEvent／resolveFiles／resolveCenter及事务复查；下架公众入口404但不删除报名／材料／队伍。完整后台见 content-management README，原归档基线保留。
