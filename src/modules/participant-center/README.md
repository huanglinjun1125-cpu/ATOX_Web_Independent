## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M007 选手中心与组队

## 当前维护摘要（2026-10-10）

- 职责：活动大厅状态／任务、招募、队伍、成员及申请。
- 公共接口：server.ts 异步 resolveCenter(eventId)；client.ts/centerRequest、contracts.ts；GET teams 公开，center 读写鉴权；旧 forCenter 静态兼容。
- 依赖与配置：M001、M002 报名／材料状态、M004/M010 活动、DB／写队列与共享组件；participantCenter 配置人数／组队期／FAQ，无独立业务变量。
- 验证：participant-center.test.ts、content-management.test.ts；浏览器 participant-center.spec.ts。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：0004 三表保留，一人一队、一份待处理申请、修订和队长审批。公开投影无私有联系方式；下架不删数据。没有团队统一提交、聊天或支付资格；重开旧窗口需单独定策略。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

版本：1.0.0。本地开发实现；生产邮件、正式活动内容及全站上线另行验收。

## 范围与入口

现有 `/events/[eventId]` 改为赛事大厅：活动信息、截止倒计时、本人报名／组队／材料进度、下一步任务、快捷入口、规则、资料、FAQ。共用 EventShell 侧栏，移动端折叠；原材料离开提醒保留。受理页仍使用原受理导航。

新增三个页面：`/events/[eventId]/teams` 公开招募；`/my-team` 我的团队；`/applications` 我的申请。后两页需登录。开团、编辑、申请及确认使用原生 dialog，支持 Escape、焦点约束和关闭恢复。报名页支持受限的 next 参数，登录／报名后恢复开团或申请意图。

每人先完成个人报名，队长审批加入；每活动限一队、一份待处理申请。人数默认 2—4，创建时队长占一个名额。组队不影响个人报名、材料或审核，不共享个人联系方式和附件。意向赛道不自动覆盖个人材料赛道。

## 接口与公开契约

`server.ts` 导出 `forCenter(eventId)`，提供 `list()`、`get(user)`、`execute(user, command)`。`client.ts` 导出浏览器 `centerRequest(eventId)`；DTO、命令类型位于 `contracts.ts`，不含数据库和秘密。

| 接口 | 权限和返回 |
| --- | --- |
| GET /api/events/:eventId/teams | 公开，只返回 TeamCard 展示字段 |
| GET /api/events/:eventId/center | 有效会话，返回本人团队、发出申请、队长待审批及开放状态 |
| POST /api/events/:eventId/center | 有效会话、同源 JSON、本人已报名及组队开放；返回更新后的 CenterDto |

命令包括 create、edit、apply、withdraw、approve、reject、leave、remove、transfer、dissolve。编辑及涉及成员的操作携带 teamId 和 revision；申请／撤回按申请 ID 及当前状态校验。响应 no-store。权限错误 403，不存在或跨活动 404，过期团队版本和状态冲突 409，无效字段 400。请求复用 M002 的 64 KiB JSON 限制、Origin 校验和错误格式。

M002 新增服务端公开投影 `forEvent(id).getRegisteredParticipant(userId)`，仅返回报名展示名、角色或 null。M007 通过它验证操作者和被审批人资格；不读写 M002 的内部业务表。

## 业务状态

- 队伍：recruiting、paused、full、closed、dissolved，由开放期、容量和配置推导。
- 申请：pending、accepted、rejected、withdrawn、expired。本人可查看历史申请；队长只看到本队仍待处理的申请。
- 队伍满员时剩余申请写为 expired；解散时所有待处理申请写为 expired。到期的 pending 在返回 DTO 时投影为 expired/CLOSED，原始记录保留，写操作被禁止。重新开放活动不是本期工作流，若运营修改旧窗口重开，须先定义旧申请迁移策略。
- 暂停招募阻止新申请，已有申请仍能审批；组队截止后所有团队写操作停止。
- 队长可以编辑、移交、移除、解散；队员可以退出。队长不能直接退出。创建新队前须先撤回待处理申请。
- 成员退出或被移除后，已通过申请显示“现已离队”；不会删除报名和材料。
- 界面每 30 秒及窗口聚焦时刷新；弹窗持有打开时的修订号，刷新不会静默覆盖编辑内容，过期写请求被拒绝。

## 数据和配置

新增 `event_teams`、`team_members`、`team_applications`。共享 schema 聚合、PGlite 连接与写队列沿用；追加迁移 `0004_slow_lady_vermin.sql`，不修改前四个迁移，不重置用户数据。

成员关系具有活动＋用户唯一约束；待处理申请具有活动＋用户的部分唯一索引；成员及申请的 teamId＋eventId 外键保证活动归属。完整写事务进入共享队列，审批再次校验成员、名额、修订号和报名资格，入队与申请更新在同一事务完成。

EventDefinition 增加可选 participantCenter 配置：minSize、maxSize、opensAt、closesAt、resources、faq、communityUrl。默认组队窗口为报名开放至材料提交截止，开始包含、截止不包含。人数最小 2、最大配置不得超过 20；资料与 FAQ 缺省时隐藏入口。当前内容为演示配置。

不新增业务环境变量。`NEXT_DIST_DIR` 是可选构建输出目录，用于隔离测试和本地开发，默认仍是 .next。

已有 dev 进程若在迁移生成前已初始化数据库，应重启后再访问组队；getDb 首次初始化自动追加迁移。不要另起迁移进程同时打开该 PGlite 目录。

## 验证与限制

服务测试覆盖报名门槛、唯一性、并发名额、公开投影、跨活动、队长权限、暂停审批、过期版本、转交退出解散、截止及数据库重开持久化。浏览器覆盖真实两账号流程、报名返回、个人草稿保留、公开接口隐私、Origin、手机、双语和弹窗焦点。

详细命令及结果见 `docs/M007-VALIDATION.md`。本模块没有团队统一提交、邀请链接、站内聊天、评分、支付资格整合、组队运营后台或正式邮件通知。个人材料及内部审核内容不会公开到招募大厅。
