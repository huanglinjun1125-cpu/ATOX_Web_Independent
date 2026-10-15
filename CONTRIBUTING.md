# 协作、交接与发布

## 开始工作

先读 AGENTS.md、docs/PROJECT_STATUS.md、docs/MODULES.md 和目标模块 README。修改 Next.js 代码前查当前安装包 `node_modules/next/dist/docs/`，不依赖旧版本惯例。通过 `npm ci` 保持 lockfile 一致；Node 24 与 CI 对齐。新成员使用自己的 `.env.local`、数据库和验证邮箱，不复制已有用户数据。

一项需求一个分支。默认从 main 创建 `feat/mNNN-description`、`fix/description`、`docs/description` 或 `chore/description`；同文件多人修改前协商归属。先检查 `git status`，不丢弃他人未提交内容，不使用强制推送或 reset --hard 处理冲突。Git 身份使用自己的 name/email（可用 GitHub noreply），不提交自动生成账号或密钥。

## 提交和 PR

提交信息采用 `feat(M002): ...`、`fix(auth): ...`、`docs: ...`、`chore: ...` 等清晰格式。提交前审查 `git diff --cached`，运行 `npm run check:repository`；只暂存本需求涉及的文件。依赖或生成工具配置变化必须带 lockfile，追加迁移必须带 SQL、snapshot、journal。

PR 使用仓库模板，说明最终问题和行为、涉及模块、验证证据、兼容风险及仍未完成内容。必要业务流程包含浏览器测试；单纯文档不添加镜像实现的业务测试。CI 的 verify 必须通过，维护者审阅后合并，推荐 squash merge。不要在 PR 或 issue 中粘贴真实用户邮箱、会话、验证码、数据库、附件或认证 trace。

main 用作共同开发基线。建议仓库管理员配置 main 分支保护／ruleset：禁止强推／删除、要求 PR、至少一名审核人、要求 CI verify 成功。这些是建议配置，不假称仓库已启用；私有仓库的可用性取决于 GitHub 计划。本次空仓库允许直接创建初始 main 基线，后续沿用 PR 流程。

## 模块交接

只开发用户确认范围，不借维护任务新增业务或执行最终整合。默认单仓库，模块不是独立 npm 包。公开边界为各模块 server.ts／client.ts／contracts.ts；M005 为配置／组件入口。身份仅通过 auth 文档化入口获得，授权和业务状态由所属模块校验。

交接必须包括职责与非范围、页面／API／DTO、数据所有权和迁移、依赖／共享文件、配置、关键状态／并发规则、验证命令和结果、集成限制和未完成事项。同步目标模块 README、PROJECT_STATUS、MODULES；设计、验收记录用 docs/MNNN-* 保留。旧验收代表当时版本，不替代当前 CI。涉及共享文件或接口变化，列出消费模块并运行对应回归。

M010/M011 共用 content-management 目录，不为表面分工复制发布核。异步发布配置、静态兼容入口、用户私有材料和公开卡片必须区分；审核通过不等于公开发布。

## 发布与版本

应用 package.json 当前 0.1.0；模块版本独立登记，不将模块标签误认作生产发布。发布前写变更说明、通过完整 CI、审查迁移和恢复步骤，维护者确认后创建不可移动的 `vX.Y.Z` 标签。接口不兼容变更提升主版本；兼容功能提升次版本；修复提升补丁版本。首个 Git 基线不擅自打生产发布标签。

历史 deliverables 快照保留在本机、排除 Git；文档中的快照路径是本地留存索引。后续 Git commit/tag 是可复查源码基线。需要 Release 附件时，从已审查 commit 生成源码并重新检查内容，不打包工作目录、.env、.data、uploads、报告或 node_modules。真实部署属于独立任务，CI 没有部署权限。

## 敏感信息与异常

发现密钥疑似泄露时停止传播，联系仓库维护者撤销／轮换，清理历史需要独立协调，不通过普通删除提交声称已移除历史泄露。提交扫描只覆盖常见模式与本地已知密钥，仍需人工审查新增资产和资料。生产事件和真实账号信息保存到受控渠道，不放仓库。
