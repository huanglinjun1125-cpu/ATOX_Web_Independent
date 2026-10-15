## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M008 管理员权限与后台入口

## 当前维护摘要（2026-10-10）

- 职责：独立角色与实时权限、授权／停用和权限审计。
- 公共接口：server.ts/getAdministrator、requireAdminPage、账号与审计服务；client.ts/adminRequest、contracts.ts；bootstrap 仅 CLI／纯服务。
- 依赖与配置：M001 已验证账号／会话、共享 DB／写队列和后台组件；无独立环境变量。真实账号不留在源码。
- 验证：admin.test.ts、admin-cli.test.ts；浏览器 admin.spec.ts；test:production。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：super_admin 当前 access/manage/audit/materials/content；operator 当前 access/materials/content。旧“仅后台首页”是原基线。0005 与永久 bootstrap 保留；禁止自停用降级和最后超管失效。业务审计另归 M009—M011，角色不进 Cookie。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

版本 1.0.0。本期仅 `/admin` 首页、账号管理、权限审计；不实现业务审核、项目发布、活动编辑、财务操作或团队运营。使用 M001 已验证用户及现有会话，不新增密码认证。

## 共享契约

`contracts.ts` 是浏览器安全契约，角色 AdminRole 为 super_admin／operator；AdminPermission 为 admin:access／admin:manage／admin:audit。权限由服务端角色计算，不能由浏览器提交权限数组或会话自行声明角色。

AdminIdentity：userId、email、role、permissions。

AdministratorDto：userId、email、role、enabled、revision、createdAt、updatedAt、updatedBy。GrantAdministratorInput 为 email、role；UpdateAdministratorInput 为 role、enabled、revision。禁用不删除用户或管理员历史。

AdminAuditDto：id、action（bootstrap／grant／update）、actor、targetUserId、targetEmail、before、after、createdAt。actor 为 source（web／bootstrap）、可空 userId、label；快照为 email、role、enabled、revision。首次授权 before 为空。审计只读，不包括尚未开发的业务审核。

运营仅有 admin:access；超级管理员具有全部三项权限。GET `/api/admin/me` 包装为 `{ administrator }`；账号及审计列表返回 `{ items, total, page, pageSize, totalPages }`，pageSize 为 20。POST `/api/admin/administrators` 接收 `{ email, role }`；PATCH `/api/admin/administrators/:userId` 接收 `{ role, enabled, revision }`。服务端后台页面使用 requireAdminPage 授权。

## 初始化与运行约束

服务端公开入口 `server.ts` 导出 getAdministrator、requireAdminPage、listAdministrators、grantAdministrator、updateAdministrator、listAudit 和 AdminError。页面逐次调用 requireAdminPage；getAdministrator 无权返回 null，requireAdminPage 未登录安全跳转、已登录无权返回 null。纯服务和 CLI 使用 service.ts，初始化函数不从 Next.js server.ts 导出。浏览器使用 client.ts 的 adminRequest，不引入服务端模型。

| 接口                                    | 权限与响应                                           |
| --------------------------------------- | ---------------------------------------------------- |
| GET /api/admin/me                       | 已登录且启用管理员，返回 `{administrator}`           |
| GET /api/admin/administrators?page=1    | 超级管理员，账号分页                                 |
| POST /api/admin/administrators          | 超级管理员，授予已有账号权限；返回 `{administrator}` |
| PATCH /api/admin/administrators/:userId | 超级管理员，检查修订号后修改；返回 `{administrator}` |
| GET /api/admin/audit?page=1             | 超级管理员，只读审计分页                             |

未登录 401、无权限 403、输入非法 400、目标不存在 404、修订或保护规则冲突 409。浏览器写请求校验 APP_ORIGIN、仅接受最多 64 KiB JSON，拒绝未知字段；分页参数仅 page，正整数最大 1000000。响应 no-store。列表按创建时间倒序，平局按稳定 ID 排序。

首位超级管理员通过一次性 CLI 建立，目标必须是 M001 已验证账号。先正常完成邮箱验证，再停止占用相同 DB_PATH 的 PGlite 服务，执行：

```powershell
npm run admin:bootstrap -- --email "your-registered-email@example.com"
```

命令沿用共享数据库配置，不公开初始化接口；必须既无任何管理员记录又无 bootstrap 审计才允许初始化。同一目标重复执行返回当前绑定，不重新授权、不恢复状态、不追加日志；不同目标返回 ALREADY_INITIALIZED。永久 bootstrap 记录保证即便管理员禁用也不能重置或恢复权限，不能以 CLI 作为后续提权途径。PGlite 单目录不能多进程同时打开；不重置用户、迁移或材料。文档不保存实际账号、密钥或运行数据。

将示例邮箱替换为你已注册的实际邮箱。命令读取现有 .env.local 和 DB_PATH，操作来源由 os.userInfo().username 记录，不能通过浏览器填写初始化操作者。执行后使用 `npm run dev` 重新启动，正常邮箱登录进入 /admin；不会新增密码或另建会话。当前工作区已追加两张空管理表，首位管理员邮箱尚未指定，未擅自授权任何现有用户。

## 授权与一致性

每次服务端请求核验当前角色与启用状态；撤权立即影响现有登录会话。账号变更携带 revision，冲突返回 REVISION_CONFLICT，不覆盖更新。禁止自停用或自降级（SELF_CHANGE_FORBIDDEN），自身无值变更请求无需失败；有效超级管理员至少保留一人（LAST_SUPER_ADMIN）。授权、更新及审计在共享写事务完成；没有公开审计删除入口。

写操作进入共享队列后，在事务内再次读取操作者权限。授权的账号查询在事务前使用 M001 只读入口，避免 PGlite 事务内嵌独立查询等待；事务中的外键和唯一约束保护身份及重复授权。撤权后新请求和排队中的写操作拒绝；已返回的页面或读取内容不能撤回，不能把菜单即时隐藏当作安全保证。

确认弹窗显式约束 Tab 焦点、Esc 取消并恢复触发按钮。409 保留输入、锁定旧修订，读取最新记录须确认放弃再重新操作；网络／500 结果未知时先扫描当前账号记录核实，禁止重复提交。权限表单不写入浏览器持久存储。

契约错误包括 UNAUTHENTICATED、FORBIDDEN、INVALID_INPUT、USER_NOT_FOUND、ADMIN_NOT_FOUND、ALREADY_ADMINISTRATOR、REVISION_CONFLICT、LAST_SUPER_ADMIN、SELF_CHANGE_FORBIDDEN、ALREADY_INITIALIZED、INTERNAL_ERROR。界面展示可恢复错误，刷新不自动重复授权。

## 跨模块边界与后续

角色属于本模块，不能写入或混入 M001 登录 Cookie 作为长期授权来源。本期不替代 M002 的 EVENT_REVIEWER_EMAILS，不自动赋予材料受理权限，不改变 M002 processed 只读和截止规则；M007 队长审批也不因此被管理员接管。

后续材料审核模块另行实施“驳回可重提”，并确定截止、审核历史与版本规则。审核与发布分离，M002 接受及 publicDisplay 意愿均不自动发布到 M006。真实项目投稿、发布／下架和公开资产需独立契约，不能直接暴露私有材料及内部备注。

设计见 [M008-DESIGN](../../../docs/M008-DESIGN.md)，验证见 [M008-VALIDATION](../../../docs/M008-VALIDATION.md)。迁移 0005 仅新增两张管理表，无新增环境变量或依赖；源码归档 deliverables/M008-admin-v1.0.0.zip 不包含密钥或运行数据，旧归档保留。生产邮件仍禁用，模块交付不代表生产上线就绪。
## M009—M011 兼容接入（2026-10-10）

有效超级／运营管理员新增 admin:materials 与 admin:content，分别负责材料审核及结构化活动／首页发布；原角色管理权限不扩大。0006 业务审计与0007内容表追加，旧用户与审计保留。材料业务不再使用邮箱白名单且不自动提权旧账号，详见各新模块 README。本段不改变 M008 原归档基线。
