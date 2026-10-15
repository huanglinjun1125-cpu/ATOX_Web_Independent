## 2026 年 10 月 14 日 独立副本更新

本文件位于 ATOX 独立开发副本，上游仓库未修改。新增 M012 活动公开内容页（src/modules/event-experience），统一全站品牌与首页。新活动筹备中，未接正式报名与团队服务。配置、验证与部署限制见 docs/INDEPENDENT_REBUILD.md；原模块的历史记录保留如下。

# 模块登记与整合索引

## 当前维护约定（2026-10-10）

当前实现包含下表全部模块；M010/M011 共用代码但职责独立。各 README 顶部维护摘要描述实际当前接口和依赖，后续旧版本段落仅作为留存轨迹。所有版本仍为本地开发／演示基线，不代表完整生产上线。

M001 继续唯一认证集成边界；M002/M007 运行入口使用异步 resolveEvent/resolveFiles/resolveCenter 绑定 M010 发布配置；M008 现已支持材料／内容权限，M009 替代旧审核白名单；M006 仍不接真实用户投稿。M003 当前 1.2 为开发模拟，与参赛资格分离。

维护交接见 [协作](../CONTRIBUTING.md)、[架构](ARCHITECTURE.md) 和 [运维](OPERATIONS.md)。本次只补工程文档和 GitHub 托管，不登记新业务编号；统一当前验证见 [仓库验收](REPOSITORY-VALIDATION.md)。源码、迁移与锁文件使用 Git 维护，原 deliverables 路径是本地历史留存索引，不存在于远端 checkout。

| 编号 | 模块                     | 版本／阶段                 | 代码                               | 交付文档                                                 |
| ---- | ------------------------ | -------------------------- | ---------------------------------- | -------------------------------------------------------- |
| M001 | 邮箱注册与登录           | 1.0.0 · 本地开发基线       | `src/modules/auth/`                | [模块说明](../src/modules/auth/README.md)                |
| M002 | 个人报名、材料提交与受理 | 1.0.0 · 已验收本地开发基线 | `src/modules/event-participation/` | [模块说明](../src/modules/event-participation/README.md) |
| M003 | 模拟购票与我的订单       | 1.2.0 · 统一界面与精简结算 | `src/modules/ticketing/`           | [模块说明](../src/modules/ticketing/README.md)           |
| M004 | 活动展板与多活动接入     | 1.0.0 · 已验收本地开发基线 | `src/modules/event-board/`         | [模块说明](../src/modules/event-board/README.md)         |
| M005 | 官网长页首页             | 1.0.0 · 已验收本地开发基线 | `src/modules/homepage/`            | [模块说明](../src/modules/homepage/README.md)            |
| M006 | 项目展区与投稿接入预留   | 1.0.0 · 已验收演示展区     | `src/modules/project-board/`       | [模块说明](../src/modules/project-board/README.md)       |
| M007 | 选手中心与组队           | 1.0.0 · 本地验证通过       | `src/modules/participant-center/`  | [模块说明](../src/modules/participant-center/README.md)  |
| M008 | 管理员权限与官方后台入口 | 1.0.0 · 本地开发基线       | `src/modules/admin/`               | [模块说明](../src/modules/admin/README.md)               |
| M009 | 选手正式材料审核 | 1.0.0 · 本地验证通过 | `src/modules/material-review/` | [模块说明](../src/modules/material-review/README.md) |
| M010 | 活动管理与发布 | 1.0.0 · 结构化发布基线 | `src/modules/content-management/` | [模块说明](../src/modules/content-management/README.md) |
| M011 | 官网内容管理 | 1.0.0 · 结构化内容基线 | `src/modules/content-management/` | [模块说明](../src/modules/content-management/README.md) |

后续模块由用户逐个指定，再登记编号、职责、入口、数据所有权、依赖、验收结果和整合事项。当前不预建团队统一提交、真实收款等额外业务实现。

## M009—M011 交接索引

- M009 `/admin/materials` 及详情，GET 列表／详情，POST `/api/admin/materials/:id/decision` 双修订审核，GET `/api/admin/materials/:id/files/:fileId` 仅正式引用附件。有效超级／运营管理员可操作；审计、原因与状态原子落库，内部备注不下发选手，草稿不进入审核。驳回仅原开放期可重提，通过只读；不自动公开项目。
- M010 `/admin/events`、`/:eventId` 与 `/:eventId/preview`，稳定 ID 创建、双语结构化草稿编辑、预览／发布／下架；M011 `/admin/content/homepage` 及 `/preview`，双语正文、三项主办方向及 metadata，首页下架回退原基线。
- GET/POST `/api/admin/content/events`；GET/PUT/POST `/api/admin/content/events/:eventId` 和 `/api/admin/content/homepage`。PUT 保存，POST 发布／下架，均带 revision。权限及修订事务复查，冲突保留输入，网络结果未知先读状态；只追加 business_audit_logs 保存操作者、时间、对象及前后内容。
- 发布核共享，业务 kind 与对象 ID 独立；追加 0006、0007，不改旧迁移或账号。无新环境变量；旧 EVENT_REVIEWER_EMAILS 已废弃且不自动提权，首次超级管理员仍使用 M008 受控初始化。
- 公众通过 readPublishedEvent／readPublishedHomepage 读取 live；M004 getEventConfig 已为异步；M002 resolveEvent／resolveFiles、M007 resolveCenter 显式绑定发布源并在写事务复查。旧同步 forEvent／forCenter 保留静态兼容，不用于生产路由绕过下架。下架保留数据及后台审核能力。
- 验证：88 项服务，44 项浏览器用例经全量与 1 项修正复验通过，类型／Lint／隔离构建、生产 2 项、购票禁用 1 项；20 张旧表迁移前后计数及内容摘要一致。分别见 [M009 验收](M009-VALIDATION.md)、[M010 验收](M010-VALIDATION.md)、[M011 验收](M011-VALIDATION.md)。
- `deliverables/M009-material-review-v1.0.0.zip`、`M010-event-management-v1.0.0.zip`、`M011-homepage-management-v1.0.0.zip` 保存当前可运行源码及模块文档，排除密钥／数据／测试运行产物；全部旧归档保留。真实独立项目投稿审核及最终部署整合另行安排。

## M008 交接索引（原交付基线，后续业务见上）

- `/admin`、`/admin/administrators`、`/admin/audit`：后台首页、超级管理员账号管理和只读权限审计；右侧菜单按真实权限显示入口，页面和 API 分别鉴权。
- 角色 `super_admin` / `operator` 独立于 M001 Cookie；运营仅首页，超级管理员管理角色和读取审计。业务审核／活动发布／官网内容管理未接入。
- 服务端 `getAdministrator`、`requireAdminPage`、账号与审计服务；浏览器 `adminRequest`；API 前缀 `/api/admin`，列表每页 20 条。
- 新增 administrators、admin_audit_logs 和 0005 迁移；沿用共享数据库与写队列，修订校验、权限重查及审计原子提交。禁用不删除用户，禁止自停用／自降级，保护有效超级管理员。
- `npm run admin:bootstrap -- --email <已注册邮箱>`：先停同目录服务，仅首次绑定，记录本机执行账号；同目标重跑不重新授权，不同目标拒绝。无公开初始化或提权接口。
- M001 最小增加服务端既有账号邮箱查询；M002 旧受理白名单与材料状态保持原样。类型、Lint、构建及测试结果见 [M008 验收](M008-VALIDATION.md)，设计见 [M008 设计](M008-DESIGN.md)。
- 验证：69 项服务、34 项浏览器回归和针对性复测通过，生产保护 2 项、票务禁用 1 项通过；原数据库 18 张旧表计数保持。
- 源码留存 `deliverables/M008-admin-v1.0.0.zip`，排除账号运行数据、密钥和测试夹具数据，旧归档保留。生产邮件与业务后台模块继续分别安排。

## M007 交接索引

- 改造现有活动大厅，新增 teams、my-team、applications 三个活动子页面；侧栏、移动折叠、状态任务、资料和 FAQ。登录与报名完成后返回原组队意图。
- 先报名、队长审批、一人一队、一份待处理申请；材料继续个人提交。公开招募不返回邮箱、联系方式、申请说明或私有材料。
- 服务端 `forCenter(eventId).list/get/execute`、浏览器 `centerRequest(eventId)`；公开 GET teams，鉴权 GET/POST center；成员变动和编辑采用修订号，读写按活动隔离。
- 新增三张组队表与迁移 0004，沿用共享连接、写队列和现有用户；M002 仅新增服务端报名展示投影及返回组队入口。
- 配置位于活动 participantCenter；默认 2—4 人，组队期报名开放至提交截止。无新增业务环境变量；NEXT_DIST_DIR 可隔离测试构建。
- 验证通过类型、Lint、构建、56 项服务测试、7 项相关浏览器测试及 1 项生产测试；见 [M007 验收](M007-VALIDATION.md)。正式邮件与生产上线另行安排。

## 统一约定

- 每个业务模块放在 `src/modules/<name>/`，提供模块说明及明确的公开入口；客户端类型和服务端秘密分开。
- Next.js 页面与 API 继续挂载在 `src/app/`，路由层尽量薄，业务逻辑归所属模块。
- 数据库连接、语言、站点导航和设计样式属于共享基础；新增表汇总到 `src/lib/schema.ts`，迁移统一追加到 `drizzle/`。
- 认证用户以 `users.id` 关联。报名资格、订单付款、项目审核等状态由各自模块拥有，不加入认证会话。
- 跨模块调用优先使用公开入口，不直接改其他模块内部表与状态；必要变更同时更新契约文档和相关回归验证。
- 当前每个模块在同一网站内验证，所有模块完成后统一检查跨模块流程、部署和验收。模块完成不代表已具备生产上线条件。
- 本地数据、环境变量、会话与开发邮件不作为交付资料复制或提交。

项目当前状态见 [项目状态](PROJECT_STATUS.md)。

## M006 交接索引

- `/projects` 已替换原占位页，公开展示 12 个原创双语演示项目；搜索、分类、活动、分页及 URL 恢复，基础预览弹层支持焦点约束及关闭恢复。
- `/projects/submit` 为公开双语说明页，真实投稿尚未开放；`/projects/[projectId]` 仅为下一详情模块的路由约定，本轮没有详情路由。
- `getProjects` / `fetchProjects` 为服务端／浏览器读取入口；`GET /api/projects` 返回显式公开卡片、分页与筛选选项。配置、查询及公开投影与 UI 分离，后续可换接数据库。
- 项目可独立或关联单场已发布活动；仅通过 M004 公开入口读取活动信息，不读取 M002 用户材料。未来投稿输入类型单独留存，不能作为现有 API 调用。
- 首页项目文案已更新，共享简洁导航增加项目入口；无新依赖、环境变量、表、迁移或业务数据改动，M003 仍独立预览。
- 设计与验收见 [M006 设计](M006-DESIGN.md)、[M006 验收](M006-VALIDATION.md)。源码归档 `deliverables/M006-project-board-v1.0.0.zip`，M001—M005 原包保留。

## M005 交接索引

- `/` 为完整组织官网长页：吸顶导航、原创 SVG 主视觉、组织介绍、主办方向、活动／项目入口及多栏页脚。双语、手机菜单、键盘、锚点与减少动态效果模式可用。
- 活动共用 `/events`，继续 M004 → M002 流程；`/projects` 在 M005 交付时为公开双语即将上线页，现已由 M006 保留 URL 并接入演示展区。M003 仍独立预览。
- `homepageConfig` 集中品牌、双语示例文案、目标及 metadata；`HomeView`、`ProjectsPlaceholder` 接收认证状态与页脚年份。共享 Header 新增 homepage 模式，默认保持 simple。
- 不新增 API、数据库、迁移、环境变量或依赖。对照 M004 确认 13 份共享 DB／schema／迁移文件未变；现有用户和业务数据保留。
- 类型、Lint、构建、44 项服务／组件、14 项 E2E、生产 1 项及开发票务禁用 1 项通过。详见 [验收记录](M005-VALIDATION.md)。留存 `deliverables/M005-homepage-v1.0.0.zip`，排除密钥与运行数据，M001—M004 原包不变。

## M004 交接索引

- 父入口 `/events` 已加入主站导航，保留首页；三个演示活动共用 M002 详情／报名／材料／受理流程。M003 仍不加入主站或参赛资格。
- 代码配置 `event-board/config.ts` 为唯一活动注册表；公开 `GET /api/events` 返回显式公开 DTO，`q`／`year`／`stage` 筛选、排序与页面共用规则。阶段与参赛窗口独立。
- M002 新增显式 `forEvent(id)`、`filesForEvent(id)`，浏览器 `createEventRequest(id)` 和 `EventProvider config`；页面、API 泛化为活动 ID，原 demo 地址和数据保留。未知／未发布返回 404，跨活动附件及受理拒绝。
- 不新增表或迁移、不复制或重置数据；继续使用全活动正式／草稿引用保护及共享写协调器。无新增环境变量。
- 验收：typecheck、Lint、生产构建、44 项服务／组件测试、11 项 E2E、生产 1 项及开发票务关闭开关 1 项通过；覆盖多活动并发隔离、正式受理／重提、边界／排序、URL 恢复、手机和平板及原模块回归。
- 详见 [设计](M004-DESIGN.md)、[验收记录](M004-VALIDATION.md)。留存 `deliverables/M004-event-board-v1.0.0.zip`；原 M001—M003 包保留，新包排除真实密钥和运行数据。

M001 的源码留存包位于 `deliverables/M001-auth-v1.0.0.zip`；内含模块与可运行网站基础，不含密钥或运行数据。

## M002 交接索引

- 范围：演示活动、个人报名成功即资格、独立草稿与正式提交、私有文件、三种受理操作；不含团队、支付、公开画廊、评分和飞书。
- 公开入口：`server.ts` 服务端业务与文件接口，`client.ts` 浏览器请求入口，`contracts.ts` DTO，`config.ts` 演示配置。API 前缀 `/api/events/demo`；页面及完整契约见模块说明。
- 数据所有权：`event_registrations`、`event_materials`、`event_assets`；依赖 M001 用户与会话，沿用共享数据库连接及写队列，追加 `0001_outstanding_molten_man.sql`，不重置用户数据。
- 状态：`not_submitted` / `pending` / `needs_changes` / `processed`，最终结果 `accepted` / `rejected`；正式资料和草稿分离，修订号冲突拒绝覆盖，截止或已处理后只读。
- 配置：`UPLOAD_PATH` 私有文件目录，`EVENT_REVIEWER_EMAILS` 受理账号白名单；内部备注仅受理人员可见。文件清理先停止相同 PGlite 目录的服务。
- 验证：类型检查、Lint、构建、服务测试 18 项、浏览器 6 项、生产 1 项均已通过；生产依赖审计 0 漏洞。包括并发提交、持久化、权限及来源隔离、未保存导航提醒、冲突保留输入、受理刷新保留输入并锁定过期版本。
- 留存目标：`deliverables/M002-event-participation-v1.0.0.zip`；M001 原包不变。本轮 M001 仅兼容接入 `next` 登录返回与共享写队列；全站整合另行进行。
- 归档包含无真实密钥的 `.env.example`，排除真实环境配置、数据库、上传材料和用户数据。下一步等待用户指定模块。

## M003 交接索引

### 1.2.0 界面与结算更新

- 三页共享主站 HACKATHON 导航、账户与语言入口和页脚，使用深色卡片／紫色／荧光绿视觉；保留开发开关和菜单入口。
- 有效资料 500 毫秒防抖自动报价，一次确认依次创建订单与发起模拟支付；报价过期、政策变化和未知请求结果均需明确处理，不自动模拟成功。
- 改票使用键盘可操作的确认弹窗；模拟面板可折叠，发起支付后展开。历史订单、路由、接口和数据库不变。
- 浏览器结算状态集中于 `components/use-checkout.ts`。验收见 `M003-1.2-VALIDATION.md`，源码归档 `deliverables/M003-ticketing-v1.2.0.zip`；保留 1.0.0／1.1.0 原归档。

### 1.1.0 接入更新

- 右上角展开菜单增加购票（模拟），仅开发且预览开关开启时显示；三页通过购买门票／我的订单导航互通。
- 新增 `/preview/ticketing/demo/orders` 与 `GET /api/preview/ticketing/demo/orders?page=1`；仅当前账号在当前演示活动的订单，快照摘要、每页 10 条、状态同步、详情／继续支付。
- 不新增业务表、迁移或配置，原支付和权限规则延续。契约见 M003 README，验收见 `M003-1.1-VALIDATION.md`，归档 `deliverables/M003-ticketing-v1.1.0.zip`；下列 1.0.0 内容作为历史基线保留。

- 两页独立预览：`/preview/ticketing/demo`、`/checkout` 子页；API 前缀 `/api/preview/ticketing/demo`。不接主站、真实收款或参赛资格；全部支付为开发模拟。
- 公开入口 server.ts、client.ts、contracts.ts、config.ts；开发开关 ENABLE_TICKETING_PREVIEW 默认 false，production 始终关闭；签名密钥 TICKETING_WEBHOOK_SECRET 至少 32 字符。本地已开启，归档示例关闭。
- 数据归属：库存、订单、幂等别名、预留、支付尝试、通知及模拟交易；追加 0002、0003 迁移，沿用共享连接与写队列，财务记录不随用户删除级联清除。
- 订单 pending／paid／closed，支付状态独立；未知结果不盲目释放库存，关闭后迟到成功标记 reconciliationRequired。维护先停同目录 PGlite 服务，再运行 `npm run ticketing:maintain`（命令设置 NODE_ENV=development），不删除财务记录。
- 最终 typecheck／lint／build、35 项服务测试、9 项 E2E、开发关闭开关 1 项及生产 1 项均通过，生产依赖审计 0 漏洞。源码归档 `deliverables/M003-ticketing-v1.0.0.zip` 已生成，M001／M002 原包不变；排除真实环境配置与用户数据，允许 `.env.example`。
