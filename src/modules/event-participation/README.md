## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M002 活动报名、材料提交与受理

## 当前维护摘要（2026-10-10）

- 职责：按活动个人报名、草稿／正式材料和私有附件。
- 公共接口：server.ts 异步 resolveEvent(eventId)／resolveFiles(eventId) 绑定发布源并事务复查；client.ts/createEventRequest、contracts.ts；旧 forEvent/filesForEvent 仅静态兼容。
- 依赖与配置：M001、M004/M010 发布配置、M008 权限、共享 DB；UPLOAD_PATH 及认证基础；EVENT_REVIEWER_EMAILS 已废弃。
- 验证：event-participation.test.ts、event-board.test.ts、material-review.test.ts；浏览器 event-participation.spec.ts、material-review.spec.ts。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：0001 及三表保留。驳回含旧 processed rejected 在原开放期可重提，accepted／截止只读；受理使用有效管理员。清理保护所有活动引用，不公开材料；历史白名单／驳回只读描述以上述当前规则为准。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

版本：1.0.0，已完成验收的本地开发基线。归档路径为 `deliverables/M002-event-participation-v1.0.0.zip`，由统筹生成；全站整合和生产上线另行验收。

## M004 多活动兼容接入（2026-10-09）

当前活动展板 `/events` 为父入口。页面及 API 已泛化为 `/events/[eventId]`、`/api/events/[eventId]`，受理为 `/review/events/[eventId]`；原 demo 地址及历史数据保持有效。配置统一来自 `event-board/config.ts` 注册表，本模块 `config.ts` 继续导出同一 demo 对象作为旧调用兼容入口。

服务端通过 `forEvent(eventId)` 获取绑定配置及报名、材料、受理操作，通过 `filesForEvent(eventId)` 获取文件操作；原 `getParticipation`、`register`、`getMaterials` 等无活动参数导出继续表示 demo。浏览器使用 `createEventRequest(eventId)`，组件使用 `EventProvider config`，禁止通过修改全局配置切换请求。所有数据及附件校验当前活动归属，清理保护所有活动的有效引用，无新增迁移或数据重置。M003 仍独立，不影响参赛资格。完整接入及验证见 [M004 模块说明](../event-board/README.md)。以下内容保留 M002 1.0.0 原始交付基线。

## 范围与页面

本轮为个人报名、个人提交，报名成功即具备提交资格；没有报名审批或付费门槛。中英文及移动端页面包括 `/events/demo`、`/events/demo/register`、`/events/demo/materials`，受理入口为 `/review/events/demo`。不包含团队、支付、评分、公开画廊、飞书同步或正式内容管理。

未登录访问受保护页面会进入 `/login?next=…`，登录后返回经安全校验的站内路径。M001 本轮只兼容接入登录返回和共享数据库写队列，原归档保持不变。

## 公开接口与契约

`server.ts` 为服务端入口：`getParticipation`、`register`、`getMaterials`、`saveDraft`、`submitMaterials`、`listReviews`、`reviewMaterials`、`isReviewer`、`uploadAsset`、`readAsset`、`cleanupOrphanFiles`。`client.ts` 提供 `eventRequest<T>` 和 `EventApiError`；浏览器使用 `contracts.ts` 的 DTO，不导入服务端文件。

以下路径统一以 `/api/events/demo` 为前缀，JSON 成功响应直接返回对应 DTO；错误为 `{ "error": "错误码" }`。

| 方法／路径               | 请求与响应                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------- |
| GET `/`                  | 公开演示活动配置                                                                      |
| GET `/participation`     | 当前用户 `ParticipationDto`，含报名、材料状态、编辑权限、阻止原因和服务端时间         |
| POST `/registration`     | `RegistrationInput` → `RegistrationDto`；同一活动同一用户重复报名返回已有记录         |
| GET `/materials`         | 当前用户 `MaterialsDto`                                                               |
| PUT `/materials/draft`   | `{ revision, payload }` → 更新后的 `MaterialsDto`                                     |
| POST `/materials/submit` | `{ revision }` → 更新后的 `MaterialsDto`                                              |
| POST `/files`            | multipart：单个 `file`、单个 `purpose`（cover/screenshot/document）→ `AssetDto`       |
| GET `/files/:id`         | 鉴权文件内容；PDF 下载，图片内联                                                      |
| GET `/review`            | 受理人员专用，`{ items: ReviewItem[] }`                                               |
| POST `/review/:id`       | `{ revision, submittedRevision, action, publicNote, internalNote? }` → `{ ok: true }` |

除配置接口外均需有效 M001 会话。修改请求还需与 `APP_ORIGIN` 完全匹配的 Origin。JSON 请求体最大 64 KiB，上传请求体最大 21 MiB；响应不缓存。

## 业务状态和版本

- `not_submitted`：未正式提交，可以有草稿；`pending`：已正式提交待受理；`needs_changes`：需补充；`processed`：已处理，只读，结果为 `accepted` 或 `rejected`。
- `official` 是已提交正式资料，`draft` 是独立修改草稿。保存草稿不改变正式资料或受理状态；提交把草稿替换为正式资料并清空草稿、既有受理结果及意见，进入 `pending`。
- 开放期内 `pending` 和 `needs_changes` 均可保存并重提。未报名、未开放、截止或 `processed` 禁止编辑和上传；截止时刻本身已属于关闭期。受理人员仍可处理已提交材料。
- `revision` 为材料整体修订号，保存、提交、受理都会递增；`submittedRevision` 仅正式提交递增。受理同时核对两者，过期请求返回 409 `REVISION_CONFLICT`，必须重新读取，不能覆盖新版本。
- 当前仅保存最新正式资料与草稿，不是完整历史版本或审核审计系统。`publicDisplay` 仅记录用户意愿，不触发公开发布。
- 编辑器对未保存内容提供离开提醒，取消导航保留输入；修订冲突保留当前输入，不自动覆盖。受理表单稳定绑定材料及版本，列表刷新保留已输入意见，并锁定过期版本，重新确认最新资料后才能继续处理。

报名字段为姓名／展示名、角色、国家或地区、机构、联系方式和条款同意，邮箱来自已登录账号。材料包括名称、一句话介绍、描述、赛道、封面、截图、PDF、视频／体验／代码链接，以及原创、使用授权、展示意愿。空内容草稿可保存，但结构、链接和文件引用仍校验；正式提交必填名称、一句话介绍、描述、有效赛道、封面、PDF，并同意原创与使用授权。截图、链接、公开展示意愿不作为必填。

## 权限与文件

`EVENT_REVIEWER_EMAILS` 指定受理账号邮箱，默认空。受理操作为需补充、接受、拒绝三种，均需填写用户可见意见；内部备注仅返回受理人员，普通用户 DTO 不含该字段。受理列表只含正式提交资料，不暴露他人草稿。普通用户仅访问自己文件；受理人员可访问别人正式资料当前引用的文件，不能访问其未提交草稿文件。

图片仅 PNG/JPEG/WebP，每张最多 5 MiB，截图最多 6 张；图片经解码重编码并移除无关元数据，限制单帧、尺寸及像素数。PDF 最多 20 MiB，校验结构、页数、页面尺寸且拒绝加密文件。存储名称由服务端生成，客户端不能指定路径。文件保存在非 public 私有目录，由鉴权接口读取，不能作为公开静态资源。

## 配置、数据与维护

`config.ts` 是演示活动配置，时区 `Asia/Shanghai`；报名和提交开放时间均为 2026-10-01 00:00 至 2027-01-01 00:00（UTC+08:00），截止不包含。活动名、地点、赛道、规则和时间均为演示数据，正式活动需替换为批准配置。

新增配置：`UPLOAD_PATH` 默认 `.data/uploads`，必须位于 `public/` 外；`EVENT_REVIEWER_EMAILS` 为逗号、分号或空白分隔邮箱。沿用 `APP_ORIGIN`、`DB_PATH` 和 M001 登录配置，不在文档或归档保存真实密钥和用户资料。

模块拥有 `event_registrations`、`event_materials`、`event_assets`，通过 `users.id` 关联 M001；每活动每用户唯一报名、唯一材料记录。模型位于 `schema.ts`，由 `src/lib/schema.ts` 聚合；追加迁移 `drizzle/0001_outstanding_molten_man.sql`，保留已有迁移及数据。共享 `src/lib/db.ts` 连接与 `serializeDatabaseWrite` 写队列，仍为单进程 PGlite。

替换资料后尽力清理不再引用的文件；失败不撤销已成功提交的资料。孤儿清理会保留全部正式资料和草稿引用，清理超过 24 小时的未引用文件及旧磁盘孤儿。**先停止占用相同 DB_PATH 的开发／生产服务，再运行维护命令；PGlite 数据目录不能被多个进程同时打开。**

```powershell
npm run db:migrate
npm run events:cleanup-files
```

命令使用 `.env.local`，确认 DB_PATH、UPLOAD_PATH 指向目标环境；不要通过重置数据库解决迁移或并发问题。

## 验证与留存

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run test:production
```

最终验收已通过：类型检查、Lint、生产构建、18 项服务测试（认证 8、返回路径 1、活动 9）、6 项浏览器测试及 1 项生产模式测试。服务断言包括并发正式提交仅一次成功、拒绝 public 目录上传、数据库关闭重开后报名／材料／附件延续。浏览器覆盖完整闭环、登录 next 返回、非受理人员 403、外站 Origin 403、冲突保留输入、取消导航保留输入、受理刷新保留输入并锁定过期版本。生产测试确认开发邮件 404、发送／验证 503、公开活动 200、受保护接口 401，以及材料页跳转登录并携带 next。`npm audit --omit=dev` 为 0 漏洞。

浏览器默认自启独立测试服务，运行前停止已有 next dev，避免构建锁冲突；生产测试需先构建。下一步等待用户指定模块。

归档 `deliverables/M002-event-participation-v1.0.0.zip` 保存本模块及可运行网站基础，包含无真实密钥的 `.env.example`，排除真实环境文件、数据库、用户数据、上传材料、邮件、依赖和构建产物。`deliverables/M001-auth-v1.0.0.zip` 保留原样。真实邮件、正式数据库／对象存储、权限治理、多活动配置及全站业务整合均为后续工作。
## M009／M010 兼容接入（2026-10-10）

驳回（含旧 processed rejected）开放期可重提，accepted仍只读；用户确认沿用原提交截止，不开放补交。受理及附件使用有效管理员权限，不自动迁移白名单角色。运行路由使用异步 resolveEvent／resolveFiles 从发布源绑定配置并在写事务复查；活动下架公众页面及API404，旧数据保留，管理员独立附件审阅仍可用。旧同步 forEvent 仅静态兼容入口，不自动读取发布数据库。原归档不变。
