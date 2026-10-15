## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M006 · 项目展区与投稿接入预留

## 当前维护摘要（2026-10-10）

- 职责：12 个原创双语演示项目、筛选分页、弹层和投稿说明。
- 公共接口：server.ts/getProjects、client.ts/fetchProjects、contracts.ts、catalog.ts/readProjectCatalog、rules.ts；GET /api/projects 只读。
- 依赖与配置：M004 公开已发布活动，间接依赖 M010；共享语言／导航、M001 登录显示；无独立变量、表或迁移。
- 验证：project-board.test.ts；浏览器 project-board.spec.ts、homepage.spec.ts。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：FutureProjectSubmissionInput 是未来设计类型；/projects/submit 没有上传表单，/projects/[projectId] 未挂载。不能将 M002 材料或审核通过直接公开；真实投稿／详情／互动待开发。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

版本：1.0.0。日期：2026-10-09（Asia/Shanghai）。本模块为公开演示展区，完整项目详情、互动及真实投稿后续分别开发。

## 页面与边界

- `/projects`：12 个原创双语演示项目，搜索、分类与活动交集筛选、每页 9 项、基础预览弹层。卡片桌面三列、平板两列、手机单列。
- `/projects/submit`：公开双语投稿说明页，无表单、上传或登录门槛，明确标注尚未开放投稿。
- 项目可独立存在或关联一场已发布活动。活动标签从 M004 公开入口解析，弹层可进入活动详情及原 M002 报名／材料流程。
- 首页项目入口文案更新为已开放，共享导航增加项目入口；M003 继续独立预览。
- 不读取 M002 用户材料、草稿、附件或受理备注。不新增业务表、迁移、环境变量、依赖或真实用户数据。

## 公开入口与配置

| 入口 | 用途 |
| --- | --- |
| `server.ts / getProjects(filters)` | 服务端公开项目查询；页面及 API 共用 |
| `client.ts / fetchProjects(filters, signal)` | 浏览器查询，支持取消旧请求 |
| `contracts.ts` | 公开项目、查询结果、筛选与未来投稿输入类型 |
| `config.ts / projectRegistry` | 稳定 ID、双语演示文案、封面、分类、可空活动 ID、展示时间、发布及演示标记 |
| `copy.ts` | 双语界面文案 |
| `catalog.ts / readProjectCatalog` | 显式公开字段投影，排除未发布项目及关联未发布／未知活动的项目 |
| `rules.ts` | 查询规范化、URL 序列化、搜索交集、排序与分页 |

封面为 `public/projects/` 下本项目原创几何 SVG，缺图使用组件内统一占位。现有 12 个项目均为示例，发布时间用于演示排序，不代表组织真实作品或业绩。分类与活动赛道相互独立。

## GET /api/projects

公开、只读，Node runtime，响应 `Cache-Control: no-store`。仅挂载 GET（Next 自动提供 HEAD／OPTIONS），不接受写入或上传。

查询参数：

- `q`：去除首尾空格、忽略大小写，同时搜索中英文名称、简介、创作者展示名称与全部标签。
- `category`：空或 `all` 表示全部；合法分类为 `software`、`hardware`、`game`、`aigc`、`other`。
- `event`：空或 `all` 表示全部，`independent` 表示独立项目，其他值为活动 ID。
- `page`：默认 1，非法、非正整数或超过安全整数范围归一为 1；超出总页数返回空项目数组，但保留实际总数及请求页码。
- 未知分类／活动返回空结果。条件取交集。按 `publishedAt` 倒序、同值按 ID 升序，每页 9 项。

响应包含 `projects`、`total`、`page`、`pageSize`、`totalPages`、规范化 `filters` 与 `options`。筛选选项基于完整已发布目录生成，不随当前搜索缩减，避免用户无法改选。

`ProjectCard` 字段：`id`、双语 `name`／`introduction`／`creator`、`cover`、`category`、双语 `tags`、可空 `eventId`／公开 `event { id, name, href }`、`publishedAt`、`demo`。不包含账号邮箱、作者用户 ID、提交原文、私有附件或内部备注。公开映射采用字段白名单，不能直接扩展源对象。

## 浏览器行为

- 查询条件写入 URL；浏览器前进后退与刷新恢复。300 毫秒搜索防抖，筛选变化回到第一页，使用 AbortController 防止旧请求覆盖最新结果。
- 加载期间显示状态，失败提供重试，不把请求失败当作无匹配结果。
- 原生 modal dialog 约束焦点，Esc／按钮／遮罩关闭；关闭恢复触发卡片焦点且不主动滚动。开启时禁止背景滚动，弹层独立滚动。
- 界面语言沿用 M001 的语言上下文及 localStorage。输入与筛选不随语言切换重置。
- 减少动态效果关闭卡片过渡；正文和卡片不依赖动画显示。

## 后续模块接入

`/projects/[projectId]` 为后续详情模块约定，本轮未挂载；当前卡片仅打开基础预览。后续保持 ID 即可切换为详情导航，不必改变首页地址。

`/projects/submit` 为真实投稿的固定入口。`FutureProjectSubmissionInput` 仅是设计契约，包含 `name`、`tagline`、`description`、`category`、可空 `eventId`、`tags`、可空 `coverAssetId`、`displayAssetIds`；不代表现有可调用 API，也不以客户端提供的所有者或发布状态作为授权依据。

真实投稿模块需要单独确定身份与附件归属、公开同意、审核发布／撤回、草稿及编辑规则后，追加持久化和写接口。当前 `getProjects` 作为读取入口可换接数据库；投稿 DTO 与公开卡片 DTO 保持分离。M002 材料即使勾选公开意愿，也不会自动进入本目录。

## 验证与交付

命令：`npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`、`npm run build`、`npm run test:production`、`npm run test:ticketing-disabled`。

新增 `tests/project-board.test.ts` 验证排序、分页、组合筛选、URL 规范化、公开字段白名单与隐藏源排除；`tests/e2e/project-board.spec.ts` 验证真实浏览器流程、API 一致性、弹层、手机、双语、失败重试及请求竞态。原首页占位测试更新，认证断言保留。

设计说明见 `docs/M006-DESIGN.md`，实际验收结果见 `docs/M006-VALIDATION.md`。源码归档目标为 `deliverables/M006-project-board-v1.0.0.zip`，仅含源码、示例配置及文档，排除运行数据和真实密钥。M001—M005 原归档保留。

## 统一导航修正（2026-10-09）

顶部改为全站共享的首页／活动／项目、语言、账户与右侧菜单，移除顶部独立投稿按钮。投稿入口继续位于项目页首屏与底部。导航与项目／首页相关 8 项浏览器用例、类型与相关 ESLint 验证通过。
