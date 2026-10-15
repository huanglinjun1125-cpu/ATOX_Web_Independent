# 本地运行、验收与部署维护

## 安全运行基线

Node 24、npm ci、自己的 .env.local；密钥仅服务端，至少 32 字符且认证／模拟支付独立。APP_ORIGIN 与访问域完全一致；127.0.0.1 和 localhost 是不同来源。单进程占用同一个 PGlite 数据目录，网站和维护 CLI 不能同时打开它。

默认 .data/pglite、.data/uploads 是私有状态，受 .gitignore 排除。若自定义为仓库其他位置，先把实际目录加入本地 .git/info/exclude 或 .gitignore，再检查暂存清单；私有目录禁止位于 public 中。新机器从空库正常应用迁移，不复制开发人员已有用户／会话或管理员。

## 验收隔离

服务测试通过临时目录保存数据，并在结束关闭连接，不打开本地实际 DB。默认 Playwright 配置重导出 admin 配置：tests/fixtures/admin-server.ts 先在独立 .data/admin-e2e-时间戳目录建立真实验证的测试账号与管理员，再关闭 DB 后启动 3100 网站。凭据 JSON 是运行夹具，禁止提交。

| 套件 | 端口 | 数据／输出 |
| --- | --- | --- |
| npm test | 无网站端口 | 各测试临时目录 |
| test:e2e | 3100 | 独立 admin-e2e 数据；.next-ticket-orders-e2e |
| test:ticketing-disabled | 3102 | 独立禁用数据；继承 NEXT_DIST_DIR |
| build / test:production | 3101（start） | 隔离生产验收数据；build/start 必须同 NEXT_DIST_DIR |

完整顺序见根 README。测试套件串行运行，端口已有监听就排查占用，不启用复用真实服务器。生产测试先构建；下一次 build/start 使用相同输出目录。可在 PowerShell 中设置 `$env:NEXT_DIST_DIR='.next-ci'` 和 `$env:DB_PATH='.data/maintenance-build/db'`、`$env:UPLOAD_PATH='.data/maintenance-build/uploads'`，隔离当前 3000 网站；构建结束后移除本 shell 的临时变量。CI 同样隔离，并由测试配置覆盖开发预览开关与测试密钥。

`npx next typegen` 可在新 checkout 生成 next-env 和路由类型，再运行 typecheck。不提交 Next.js 自动产物。失败查终端和本地 test-results，trace 可能包含登录 Cookie／填写资料，不能发到公开 issue 或默认上传到 Actions 附件。

## 迁移与备份

getDb 初始化自动迁移；人工 npm run db:migrate 读取 .env.local。结构变更生成新迁移，审查 SQL、外键、唯一约束、journal 和 snapshot；不修改 0000—0007。迁移前停止所有使用目标 DB 的进程并备份完整 DB_PATH 与 UPLOAD_PATH 到仓库外受控位置，包含匹配时间点的文件、配置引用和恢复说明，密钥单独受控保存。

迁移后重启网站，检查公开页面、用户／会话及相关材料。失败先停服诊断，恢复应使用已验证的成套备份，不能混用不同时间点数据库和附件。没有自动回滚命令，不用删表、重置数据或重新 bootstrap 解问题。

## 维护命令

- events:cleanup-files：超过 24 小时的孤儿文件；保护所有活动正式材料及草稿有效引用。
- ticketing:maintain：开发模拟支付查单、关单、预留处理；未知状态保留且继续核对，不删除财务历史。必须启用开发预览。
- admin:bootstrap：首位超级管理员一次性绑定已验证账号，停服执行，记录本机操作者；同目标重复不恢复禁用或提权。之后用授权后台管理。

以上均与网站互斥占用同数据目录。不要发布运行数据、实际管理员邮箱或维护输出中的个人信息。

## 开发 HMR 循环排错

登录页若反复整页重载，先区分 HTTP 重定向与 HMR。此前实际发现 WebSocket HMR hash mismatch；停止该工作区的 next dev 和相关子进程，将对应 .next/dev 生成缓存移动到工作区内备份后重启解决。只处理确认的构建缓存，不修改认证数据、会话或业务权限。Windows 递归移动／删除前验证绝对路径位于目标工作区，不一并删除 .data 或 .env.local。

## 生产模式与正式上线

npm run build + npm start 是当前支持的 Node 运行路径，使用服务端接口，不能静态导出到 GitHub Pages。当前 start 默认监听本机，远程访问需要另行确定代理／网络配置。部署包需包含 Next 输出、运行依赖、public 和完整 drizzle 目录；数据目录与上传目录应位于可持久化私有存储，不能只复制生成页面。

目前生产模式开发邮箱／模拟票务 404，验证码发送／验证 503 MAIL_DISABLED；即使开关 true 也不能恢复开发登录。正式上线先另行开发真实邮件和故障投递、HTTPS／同源／代理、生产数据库迁移、公开／私有存储、备份恢复和安全验收。PGlite 默认模式不支持多副本或临时 serverless 文件系统，PostgreSQL 迁移不属于本次工程整理。

仓库没有生产部署工作流、生产密钥或容器配置。维护者后续确定平台和生产条件再实施；本次 CI 不部署、不收款、不访问实际用户数据库。
