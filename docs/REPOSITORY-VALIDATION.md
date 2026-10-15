# GitHub 仓库整理验收

日期：2026-10-10（Asia/Shanghai）。任务为工程整理、维护文档与代码托管，不增加业务模块、不执行最终全站整合。

## 初始检查

已读 AGENTS、PROJECT_STATUS 和 MODULES；初始工作目录无 .git，远端 aladyaraya/Atox_Web 是空私有仓库。采用单仓库 main 初始基线，后续 PR 约定见 CONTRIBUTING。GitHub 已有有效账号和 workflow 权限，不保存凭据。

M001—M011 已存在，M010/M011 共用发布核。源码、共享数据库连接和 0000—0007 迁移留存；本地真实环境、数据库、附件、归档、认证测试夹具、日志和构建不上传。历史验收数字保留原版本含义，当前验证以本文件及 CI 为准。

## 变更

扩展 ignore、统一 LF、Node 24 版本文件；重写根 README，补模块维护摘要、架构、协作和运维手册、安全示例配置、PR 模板。增加 Git index 提交扫描和只读 CI；Lint／TypeScript 排除任意隔离构建输出。无业务 API、表、迁移或生产部署新增。

## 当前验证

- 本地 Node 24.17.0 / npm 11.13.0：Lint、Next typegen、TypeScript、生产构建通过。
- 服务测试 88/88；完整浏览器回归 44/44（单次全量通过）；生产保护 2/2；开发票务关闭 1/1。测试数据、私有附件与构建输出均隔离于现有 3000 网站。
- Git index 扫描通过，未发现禁止路径、常见凭据模式或复制本地密钥；额外负向验证确认环境文件、凭据模式、运行数据均被拒绝且值不打印。现有 URL 拒绝测试的 user/pass@example.com 仅有精确字面量例外，不对测试目录整体豁免。
- 所有 Markdown 本地文件链接检查通过；git diff --cached --check 的旧文档末尾空行已整理。原业务实现、共享 DB 和迁移没有修改；.env.local／.data／私有截图／deliverables 全部忽略，实际账号和会话不复制到仓库。
- 首次推送采用 main 初始提交；未创建生产标签、强推或执行部署。后续默认分支 PR 协作。
- 远端在干净 Ubuntu 环境以 npm ci 安装并运行完整 CI；实际 commit 对应结果见 [CI 工作流](https://github.com/aladyaraya/Atox_Web/actions/workflows/ci.yml)，推送后核验结果在最终交付报告记录，不将本地通过等同于远端已通过。

开发测试日志包含非阻断提示：NO_COLOR/FORCE_COLOR、部分 SVG 首屏 loading 建议，以及截图工具暂时注入 caret 样式产生的 hydration 提示；全部用例通过，本次不借工程整理修改这些业务界面。

## 仍需配置

main 分支保护和审核人／协作权限由仓库维护者按团队与 GitHub 计划配置；生产邮件、数据库／对象存储、HTTPS 和上线条件待独立任务；项目详情、互动、真实投稿／发布与真实支付继续按模块安排。仓库无开源许可证，授权发布前不自行添加。
