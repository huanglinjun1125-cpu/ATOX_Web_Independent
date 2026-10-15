# ATOX 独立网站副本

本仓库是基于 aladyaraya/Atox_Web 的独立开发副本，统一 ATOX 品牌视觉，并加入马来西亚 AI 与 MVP 黑客松活动页面。原开发者仓库未修改。

[查看在线展示](https://atox-web-independent.goodcharm129.chatgpt.site) · [GitHub 源码](https://github.com/huanglinjun1125-cpu/ATOX_Web_Independent)

在线链接已开放访问，适合分享页面设计与公开活动信息；正式登录、报名和支付仍待服务配置。

基线来源：https://github.com/aladyaraya/Atox_Web ，基线提交 `39a9ea9603852ee6dada34d229ee1bb80ac4cddb`。保留原模块、数据库迁移、认证与权限逻辑；没有复制任何账户、密钥或私有运行数据。原说明留存在 [UPSTREAM_README](docs/UPSTREAM_README.md)。没有新增开源许可证。

## 这次交付

- 全站品牌：黑色背景、暖白文字、珊瑚红点缀、细线结构；共享导航、字体、表单、按钮、目录和后台页面统一。
- 品牌首页：ATOX AI 青年生态定位、中英文内容、组织方向、活动入口、项目入口与统一页脚。
- 活动目录：搜索、年份和阶段筛选、推荐活动、明确标识演示内容。
- 马来西亚活动：七个建议赛道、22 个议程时段、键盘可用的议程标签、赛道说明弹窗、线上和线下参与方式、评审准备原则、FAQ、拟议日历下载。
- 项目展区：保留双语搜索、分类和活动筛选、分页及项目预览。当前作品是明确标注的演示内容。
- 原有登录、报名、材料、组队、权限与管理后台源码保留。公开预览没有接入这些服务。

## 页面与内容

| 路径 | 内容 |
| --- | --- |
| `/` | ATOX 品牌首页 |
| `/events` | 活动目录 |
| `/events/malaysia-ai-mvp-2026` | 新活动详情，默认英文，可切换中文 |
| `/projects` | 创造者演示项目展区 |
| `/projects/submit` | 原有投稿预留入口 |
| `/login`、`/account` | 原有邮箱认证与账户 |
| `/events/demo/*` | 原有演示报名、材料和团队流程 |
| `/admin/*` | 原有受权限保护的运营后台 |

活动采用最新策划案的 `ATOX × TAMAPUSC at APU` 定位，日期为 2026 年 12 月 4–6 日，MYT / UTC+8。APU 场地、校方背书、导师、评委、合作伙伴、奖项和正式报名仍待确认。页面没有将其标为已确认，也没有使用未经许可的 WORQ 标志。

## 启动完整应用

需要 Node 24。

```sh
npm ci
cp .env.example .env.local
# 为 AUTH_SECRET 配置独立随机值，不提交 .env.local
npm run dev
```

使用 `.env.example` 配置变量，保留自己的现有配置。完整应用仍采用 Next.js App Router、React、TypeScript、Drizzle 与 PGlite。开发验证码在 `/dev/mail` 查看，不发送真实邮件。生产模式继续关闭开发邮件和模拟票务。

```sh
npm run build
npm start
```

生产登录、真实邮件、正式数据库、文件存储、支付、域名与服务部署仍按原项目的上线条件另行配置；本次品牌重构不宣称完成这些第三方服务。

## 公开页面预览

```sh
npm run build:preview
```

生成 `dist/`，包含首页、目录、项目展区与活动长页。复用同一套 React 页面和样式，不维护第二套视觉。项目筛选在预览中使用公开演示目录，私有业务页面显示服务尚未开放说明，不假装成功登录或提交。预览不包含后端密钥、账户数据、真实表单或分析追踪。

## 维护入口

- 品牌基础：`src/components/brand.css`、`brand-art.tsx`
- 双语首页内容：`src/modules/homepage/config.ts`
- 活动内容与意向链接：`src/modules/event-experience/config.ts`
- 活动页面：`src/modules/event-experience/components/event-view.tsx`
- 设计说明：[BRAND_SYSTEM](docs/BRAND_SYSTEM.md)
- 开发记录：[INDEPENDENT_REBUILD](docs/INDEPENDENT_REBUILD.md)

确认正式意向表单、负责人及隐私说明后，填写 `malaysiaEvent.interestUrl`，按钮将链接到经过 HTTPS 校验的正式入口。当前 `null` 状态显示筹备说明，并允许下载拟议日期；不会采集联系方式。新活动是公开内容页，未虚构个人报名或提交时间窗口，不接入 M002/M007 业务服务。

## 验证

```sh
npx next typegen
npm run typecheck
npm test
npm run build
npm run build:preview
npm run check:repository
```

保留原有 Playwright 回归套件，需在具备浏览器验收环境时运行。仓库托管和公开页面预览不等于完整生产上线。
