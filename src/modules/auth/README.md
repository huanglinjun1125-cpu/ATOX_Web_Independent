## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M001 · 邮箱认证模块

## 当前维护摘要（2026-10-10）

- 职责：身份与开发邮箱；不包含业务资格／角色。
- 公共接口：server.ts/getCurrentUser、findRegisteredUserByEmail；client.ts、contracts.ts；纯服务测试和 CLI 用 service.ts。
- 依赖与配置：共享 DB／写队列、语言及导航；AUTH_SECRET、APP_ORIGIN、DB_PATH、ENABLE_DEV_MAIL、TRUST_PROXY。
- 验证：auth.test.ts、return-path.test.ts；浏览器 login.spec.ts；test:production。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：0000 及账号／会话延续；生产验证码登录禁用。其他模块只经认证公开入口获得身份，再检查自己资源权限。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

版本：**1.0.0（本地开发基线）**。业务范围：邮箱验证码注册／登录、会话查询与退出、开发邮件预览。此模块不包含活动报名、团队、支付、项目材料、业务角色或资源权限。

## 模块结构与接入入口

| 文件           | 职责                                                        |
| -------------- | ----------------------------------------------------------- |
| `server.ts`    | Next.js 服务端公开入口，使用 `server-only` 阻止客户端误导入 |
| `client.ts`    | 浏览器 API 调用与 `AuthClientError` 错误处理                |
| `contracts.ts` | 浏览器安全的请求／响应类型、用户类型、错误码及接口路径      |
| `service.ts`   | 注册、验证码、会话核心逻辑；不读取 Next.js Cookie           |
| `session.ts`   | Next.js Cookie 与核心服务之间的适配                         |
| `policy.ts`    | 验证码、限流与会话规则的集中配置                            |
| `schema.ts`    | 本模块拥有的数据表                                          |
| `mail.ts`      | 本地邮件适配和开发邮箱查询                                  |
| `http.ts`      | 认证接口的同源校验、IP 提取、JSON 限制与错误响应            |
| `components/`  | 登录、账户、邮件预览 UI                                     |

本模块依赖共享数据库 `src/lib/db.ts`，以及网站的语言提供器、导航／页脚和全局样式。它是单仓库内的业务模块，**不是可单独部署或直接复制即用的 npm 包**。

Next.js 路由保留在 `src/app/`，仅负责路由挂载和协议适配。旧的 `src/lib/auth.ts`、`mail.ts`、`http.ts` 仅为服务端兼容入口，新模块不要新增对此路径的依赖。`src/lib/schema.ts` 是全站数据库模型聚合入口，不是旧业务实现。

## 后续业务模块如何使用

服务端获取当前用户：

```ts
import { getCurrentUser } from "@/modules/auth/server";

const user = await getCurrentUser();
// 未登录返回 null；页面可 redirect('/login')，业务 API 应返回 401。
// user.id 是后续报名、团队、项目与订单的身份关联键。
```

浏览器调用：

```ts
import {
  sendLoginCode,
  verifyLoginCode,
  logout,
  AuthClientError,
} from "@/modules/auth/client";

await sendLoginCode({ email: "you@example.com", language: "zh" });
await verifyLoginCode({ email: "you@example.com", code: "123456" });
await logout();
// 失败抛 AuthClientError，包含 code 和可选 retryAfter。
```

纯服务测试直接导入 `service.ts`，不导入 Next.js 专用 `server.ts`。服务返回的用户时间是 `Date`；HTTP JSON 中序列化为 ISO 字符串。随机会话令牌仅在服务内部交给路由设置 Cookie，不属于公开用户 DTO。

后续模块必须在服务端验证身份，并自行校验资源归属；认证成功不等于拥有某团队、项目、订单或管理员权限。不得信任浏览器提交的 `userId` 作为身份，不得复制用户表或直接写入验证码／会话表。

## 已确定的业务规则

1. 邮箱去除首尾空白并转小写，不合并点号或 `+alias`。首次验证创建唯一用户，再次验证复用同一用户 ID。
2. 六位数字验证码，10 分钟有效；重发作废旧挑战，验证成功只能消费一次。
3. 同邮箱 60 秒内不可重发，每小时最多 5 次；同来源 IP 每小时最多 20 次。
4. 每条挑战最多错误 5 次；错误计数提交后再返回失败，防止事务回滚绕过次数限制。
5. 验证码摘要使用带密钥 HMAC；会话随机令牌仅保存 SHA-256 摘要。
6. 消费验证码、建立／复用用户和创建会话在同一事务内完成。当前进程写操作串行化，阻止并发重复消费。
7. 会话有效期 7 天且不续期。退出撤销当前会话，其他设备会话不受影响。
8. 修改接口检查 `Origin`，发送和验证仅接收不超过 4096 字节的 JSON。身份接口不缓存。
9. 本地开发邮箱只在 `NODE_ENV=development` 且 `ENABLE_DEV_MAIL=true` 时启用；不会发送真实邮件。

## HTTP 契约 v1

| 接口                         | 请求／成功响应                                                          | 错误                     |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------ |
| `POST /api/auth/send-code`   | `{email,language:'zh'\|'en'}` → `{ok:true,retryAfter:60,expiresIn:600}` | 400、403、429、503、500  |
| `POST /api/auth/verify-code` | `{email,code}` → `{ok:true,user:{id,email,createdAt}}` + Cookie         | 400、403、429、503、500  |
| `GET /api/auth/me`           | `{user:{id,email,createdAt}}`                                           | 未登录 401 `{user:null}` |
| `POST /api/auth/logout`      | 无请求体 → `{ok:true}`                                                  | 403、500                 |

普通错误为 `{error:AuthErrorCode,retryAfter?:number}`，限流适用时带 `Retry-After` 响应头。完整错误码以 `contracts.ts` 为准。Cookie 名为 `hackathon_session`，`HttpOnly`、`SameSite=Lax`、路径 `/`，production 下为 `Secure`。公开响应中没有验证码、令牌或摘要。

页面挂载：`/login`、`/account`、`/dev/mail`。未登录访问 `/account` 跳转登录；首页根据会话显示账户入口。

M002 兼容接入：`/login?next=/events/demo/materials` 可在验证成功后返回站内目标页；已登录访问登录页也使用该目标。`return-path.ts` 校验参数并拒绝外站、协议相对地址、反斜杠、控制字符和登录循环，默认 `/account`。认证 HTTP 契约不变。所有认证与报名模块写操作改用共享 `src/lib/db.ts` 的 `serializeDatabaseWrite`，覆盖完整事务，禁止嵌套调用。原始 M001 1.0.0 归档保持不变，本段描述当前工作区的兼容增量。

## 数据所有权与迁移

M008 最小兼容增量：服务端公开 `findRegisteredUserByEmail(email)`，规范化邮箱并只读返回既有 `AuthUser` 或 null，供受控管理员授权和初始化查询。无新增 HTTP 用户检索接口，不发送验证码、不创建账号、不修改会话。生产邮件限制和其他认证规则不变。

本模块拥有 `users`、`challenges`、`sessions`、`send_events`、`dev_mails`。表名、字段、约束与历史迁移保持原样；本次模块化没有数据迁移，也不重置任何账号或会话。

原始迁移为 `drizzle/0000_auth.sql`，snapshot/journal 位于 `drizzle/meta/`。所有模块共享这一条版本化迁移历史；新增业务表通过新迁移追加，不修改已应用的认证迁移。后续实体关联 `users.id`，具体删除策略由其业务定义。

共享 DB 使用本地 PGlite、全局单例、磁盘目录持久化。单个目录只支持一个 Node 进程访问；服务运行期间不要另启迁移进程。测试使用独立临时数据，不清理用户本地数据库。

## 配置与部署边界

配置项：`AUTH_SECRET`（至少 32 字符）、`APP_ORIGIN`、`DB_PATH`、`ENABLE_DEV_MAIL`、`TRUST_PROXY`。环境变量和数据库数据不纳入源码版本控制。运行方法见根 README。

目前 production 下开发邮箱 404，发送／验证接口 503 `MAIL_DISABLED`。正式上线尚需真实邮件服务、HTTPS、可信代理配置、生产 PostgreSQL 及多进程下数据库级并发／限流设计。将来替换邮件适配时，需要同时调整服务的邮件可用性检查，不能只替换模板函数；真实发信应设计事务提交后的投递与失败处理。

不要将邮箱或会话令牌作为后续业务主键，不要在业务响应／日志复制开发邮件正文或认证秘密。

## 验收与后续整合

基线检查包括类型、Lint、构建、8 项核心服务测试、3 项浏览器测试和 1 项生产模式测试。核心测试包含新 Node 进程恢复已有会话；数据库审查确认移动 schema 后无 DDL 差异。

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run test:production
```

默认浏览器测试自启独立开发服务，运行前应停止现有 `next dev`，避免同一构建目录的开发锁冲突。需要验证已经运行的本机开发服务时，可执行：

```powershell
npx cross-env PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

显式指定 URL 后不会启动／停止该服务；测试会向其开发数据库增加测试用户和邮件，仅用于本地环境。

整合时复查：用户 ID 关联、服务端身份校验、Cookie 域与路径、同源地址、环境变量、共享数据库和迁移、全局样式与语言提供器。改动公开契约或业务规则时更新本文版本和测试；新增模块不应静默改变本模块行为。
