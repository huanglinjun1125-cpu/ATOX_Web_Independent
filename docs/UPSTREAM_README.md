# HACKATHON · Atox Web

面向创造者的黑客松活动网站，采用单仓库、模块化 Next.js 全栈结构。临时品牌和活动／项目内容是明确标注的演示数据。当前用于本地开发与验收，尚未生产上线。

已实现邮箱认证、活动展板、个人报名与私有材料、选手组队、官网首页、演示项目展区及管理员权限／材料审核／活动和首页发布。票务仅为开发模式模拟支付；项目投稿页仅预留入口，完整项目详情、互动、真实投稿发布、真实收款、飞书同步、团队统一提交和最终全站整合尚未完成。

[项目状态](docs/PROJECT_STATUS.md) · [模块登记](docs/MODULES.md) · [架构与边界](docs/ARCHITECTURE.md) · [协作约定](CONTRIBUTING.md) · [维护手册](docs/OPERATIONS.md) · [验证记录](docs/REPOSITORY-VALIDATION.md)

## 技术与环境

- Next.js App Router、React、TypeScript、Tailwind CSS；服务端 Node runtime。
- Drizzle + 本地持久化 PGlite；无需 Docker 或独立数据库安装。
- Node.js >=22；团队和 CI 统一使用 Node **24**（`.nvmrc`），npm 和 `package-lock.json`。
- Git；浏览器验收需要 Playwright Chromium。Windows PowerShell、macOS／Linux 均可开发。

## 安装与启动

```sh
git clone https://github.com/aladyaraya/Atox_Web.git
cd Atox_Web
npm ci
```

首次配置，在 PowerShell 中执行 `Copy-Item .env.example .env.local`，macOS／Linux 执行 `cp .env.example .env.local`。**已有 `.env.local` 时保留原文件**。生成密钥并填入 AUTH_SECRET；如果开启模拟购票，为 TICKETING_WEBHOOK_SECRET 单独生成另一个值：

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev
```

访问 http://localhost:3000。邮箱验证码在 `/dev/mail` 查看，不发送真实邮件。`APP_ORIGIN` 必须与浏览器的协议、主机、端口完全一致；默认仅监听 127.0.0.1。修改端口／主机后同步配置并重启。

## 目录与模块

```text
src/app/                  页面、API、路由适配；业务逻辑放模块内
src/modules/              M001—M011（M010/M011 共用发布核）
src/components/           共享导航、语言、布局及兼容导出
src/lib/                  共享 DB、schema 聚合和兼容适配
drizzle/                  0000—0007 追加迁移、snapshot 和 journal
public/                   原创 SVG 等公开资产；禁止放私有附件
tests/                    服务／规则、隔离浏览器、生产禁用测试
scripts/                  迁移、受控初始化、维护和提交扫描
docs/                     当前状态、模块、设计、验收和运维约定
产品相关/                 产品方案；属于设计资料，不代表均已实现
.github/                  CI 和 PR 模板
.data/                    本地 DB、私有文件、夹具及日志（不入 Git）
deliverables/             原模块源码快照，仅本地保留（不入 Git）
```

| 模块 | 职责 | 说明 |
| --- | --- | --- |
| M001 | 邮箱验证码、注册／登录、会话 | [auth](src/modules/auth/README.md) |
| M002 | 活动个人报名、草稿／正式材料、私有附件 | [event-participation](src/modules/event-participation/README.md) |
| M003 | 开发模拟购票、订单及支付维护 | [ticketing](src/modules/ticketing/README.md) |
| M004 | 活动目录、公开配置和阶段筛选 | [event-board](src/modules/event-board/README.md) |
| M005 | 长页首页与演示内容基线 | [homepage](src/modules/homepage/README.md) |
| M006 | 原创演示项目卡片、筛选、预览和投稿预留 | [project-board](src/modules/project-board/README.md) |
| M007 | 选手中心、招募、队伍和申请 | [participant-center](src/modules/participant-center/README.md) |
| M008 | 管理员授权与权限审计 | [admin](src/modules/admin/README.md) |
| M009 | 正式材料审核与业务审计 | [material-review](src/modules/material-review/README.md) |
| M010 / M011 | 结构化活动／首页草稿、预览、发布与下架 | [content-management](src/modules/content-management/README.md) |

## 配置

以 [.env.example](.env.example) 为变量清单，不提交真实配置。服务端密钥不得增加 NEXT_PUBLIC_ 前缀。

| 变量 | 默认／用途 |
| --- | --- |
| AUTH_SECRET | 必填，至少 32 字符的随机值；验证码 HMAC 密钥 |
| APP_ORIGIN | `http://localhost:3000`，修改请求唯一同源地址 |
| ENABLE_DEV_MAIL | 示例 true；仅 development 可用；公众不能访问开发邮箱 |
| DB_PATH | `.data/pglite`；PGlite 私有持久化目录 |
| UPLOAD_PATH | `.data/uploads`；必须在 public 以外 |
| TRUST_PROXY | false；仅清除并重写转发头的可信代理后可开 |
| ENABLE_TICKETING_PREVIEW | false；仅 development 显式 true 开启模拟模块 |
| TICKETING_WEBHOOK_SECRET | 模拟支付启用时必填、至少 32 字符、与认证密钥独立 |
| NEXT_DIST_DIR | 可选构建目录，默认 `.next`；隔离验收可用 `.next-ci` |

NODE_ENV 由 Next.js 设置。ADMIN_FIXTURE_FILE 仅由测试配置生成。旧 EVENT_REVIEWER_EMAILS 已废弃；当前审核通过有效管理员角色授权。仓库不包含任何已有管理员、账号、会话或订单数据。

## 验证与 CI

```sh
npm run lint
npx next typegen
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run test:ticketing-disabled
npm run build
npm run test:production
```

提交前暂存拟提交文件，再运行 `npm run check:repository`，扫描 Git index 的真实待提交内容。它检查禁止路径、常见凭据模式及是否复制本地密钥，是人工复核的补充，不能保证识别所有敏感数据。

GitHub Actions 在 push／PR 执行以上检查，使用 Node 24、`npm ci`、隔离数据库／构建和 Chromium，不需要业务密钥、真实账号或生产访问。测试端口为 3100／3101／3102；不要并行启动多个浏览器套件。详细隔离和排错见 [维护手册](docs/OPERATIONS.md)。测试报告和认证 trace 留在本地，不上传为 CI 附件。

## 数据库与管理员维护

`src/lib/db.ts` 提供进程内连接单例及跨模块写队列；首次 getDb 自动应用 `drizzle/` 中尚未应用的迁移。相同数据目录只允许一个 Node 进程占用。变更表结构后执行 `npm run db:generate`，审查新增 SQL、snapshot、journal 一并提交；已应用迁移禁止改写。

人工执行以下命令前，先停止占用相同 DB_PATH 的网站，备份 DB 和私有上传目录：

```sh
npm run db:migrate
npm run events:cleanup-files
npm run ticketing:maintain
```

命令读取 `.env.local`；票务维护仍需开发预览开启。禁止删数据、重置库存或改历史迁移来处理故障。维护后重启网站，检查会话、公开页和相关流程。

首位管理员必须先完成正常邮箱验证，然后停服执行 `npm run admin:bootstrap -- --email registered@example.com`。这是一次性初始化，不是恢复或提权通道。后续管理员由超级管理员在 `/admin/administrators` 授权；权限实时从数据库核验，不写进认证 Cookie。不要将实际管理员邮箱留在源码或文档。

## 部署现状

目前支持本地单进程 Node 服务。`npm run build` 后 `npm start` 可用于生产模式验收；认证 API 和文件接口需要服务端，不能发布为 GitHub Pages 静态站。CI 只验证，不部署。

生产模式 `/dev/mail` 和模拟购票均为 404，发送／验证验证码返回 503 MAIL_DISABLED。完整上线须另行实现真实邮件及失败投递、HTTPS／域名和来源配置、正式数据库及并发设计、对象存储／备份和真实支付对账。本地 PGlite 不能直接扩展为多副本或共享 serverless 数据库；正式 PostgreSQL 迁移尚未实施。详见 [维护与部署](docs/OPERATIONS.md)。

## 多人协作

默认基于 main 建 `feat/*`、`fix/*`、`docs/*` 或 `chore/*` 分支，PR 描述最终行为、验证及兼容影响；不得强制推送共享分支。模块变更同步 README、状态和登记表。发布通过独立审查和标签标记，源码托管不代表生产上线；历史本地归档保留，后续用 Git commit／tag 追踪。详见 [CONTRIBUTING](CONTRIBUTING.md)。仓库暂无授权开源许可证，不能将 private 字段或私有仓库误解为开源许可。
