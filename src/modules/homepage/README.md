## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M005 官网长页首页

## 当前维护摘要（2026-10-10）

- 职责：组织长页、原创主视觉、主办方向、探索与页脚；内容仍为演示。
- 公共接口：config.ts/homepageConfig 静态回退；HomeView（signedIn、year、可选 content）；根页 getCurrentUser/readPublishedHomepage 并生成 metadata。
- 依赖与配置：M001、M011、共享 SiteHeader／语言和 M004/M006 地址；无独立 API、变量、表或迁移，运行发布内容沿用 DB。
- 验证：浏览器 homepage.spec.ts、navigation.spec.ts、content-management.spec.ts；完整类型、lint、服务与构建回归。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：共享导航已统一；/projects 已由 M006 承接，原 ProjectsPlaceholder 为历史描述。首页仅编辑结构化正文，不改代码／身份，撤回回退示例。M003 菜单只开发启用。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

版本：1.0.0 · 官网长页首页。临时品牌 HACKATHON，深色艺术视觉、紫色与荧光绿强调色，组织介绍为明确标示的演示内容。

## 范围与入口

- `/`：公开官网首页。吸顶导航、接近一屏的原创 SVG 主视觉、组织介绍、主办内容、活动／项目入口、多栏页脚。
- `/events`：原 M004 活动展板，继续进入 M002 详情、报名、材料与受理；本模块不复制活动配置或报名逻辑。
- `/projects`：公开双语“项目展板即将上线”占位页。仅提供返回首页与探索活动，不展示项目、提交表单或订阅功能。下一模块保留该路由并替换页面组件。

M001 邮箱认证继续提供登录状态，未登录显示登录／注册，已登录显示我的账户。M003 购票与模拟支付继续独立预览，不加入官网导航或参赛资格。

## 模块接口与配置

`config.ts` 的 `homepageConfig` 集中维护临时品牌、双语文案、主办内容示例、目标路由及页面 metadata；更换正式组织资料时从这里修改。首页没有虚构团队规模、业绩、合作方、社交账号、联系方式或备案信息。

组件公开入口：

```tsx
<HomeView signedIn={boolean} year={number} />
<ProjectsPlaceholder signedIn={boolean} year={number} />
```

根页面通过认证公开入口 `getCurrentUser()` 获取会话，按 Asia/Shanghai 计算页脚年份并传入组件。路由层保持薄。旧 `src/components/home-view.tsx` 仅保留兼容导出，新代码从所属模块导入。

共享 `Header` 增加 `variant="homepage"`，默认仍为原有 simple 模式。官网与占位页使用完整导航，其他模块保持简洁导航。`HomepageFooter` 为官网专用多栏页脚；首页样式限定在 `.hp-site`，没有覆盖其他模块组件。

不新增 API、数据库表、迁移、环境变量或第三方依赖，不写用户数据。共享数据库连接和迁移文件保持原样。

## 页面和可访问性

导航关于我们和主办内容分别指向 `/#about`、`/#programs`。页内锚点避开吸顶导航，普通连续滚动，不强制吸附；底部可返回顶部。活动与项目链接在导航、首屏、探索卡片及页脚共用配置地址。

手机及平板导航在 960px 以下折叠，按钮带 `aria-expanded`／`aria-controls`，Enter 打开、Tab 访问链接、Esc 关闭并恢复按钮焦点；点击链接、点击外部或焦点离开导航时收起。页头提供跳至主要内容链接；正文使用语义标题和命名导航区域。

中英文使用已有语言能力，刷新保留语言。切换语言保留 URL 锚点和当前阅读章节；中英文段落高度不同，浏览器滚动锚定可能调整绝对 scrollY，页面不会强制回到顶部。

原创图形由 `components/hero-art.tsx` 的 SVG 轨道、光点与流动地平线构成；装饰不进入读屏内容，正文不依赖动画。动效仅轻量透明度变化，不使用 WebGL、视频或远程素材。减少动态效果模式关闭动画、过渡和平滑滚动。按本地 Next.js 16 指南，根 html 声明 `data-scroll-behavior="smooth"`，让路由切换正常处理滚动；平滑 CSS 仅在 `.hp-site` 存在时启用。

## 本地运行、验证与留存

沿用根 README 中的 `.env.local`、Node.js 与本地运行配置：

```powershell
npm install
npm run dev
```

打开 http://localhost:3000/ 。测试与构建命令：

```powershell
npm run typecheck
npm run lint
npm run build
npm test
npm run test:e2e
npm run test:production
npm run test:ticketing-disabled
```

测试使用隔离的数据库与上传目录，运行构建／浏览器测试前停止同工作区开发服务，避免共享 Next 构建产物冲突。不要重置实际数据库或覆盖现有 `.env.local`。

验收详情见 `docs/M005-VALIDATION.md`。源码留存包 `deliverables/M005-homepage-v1.0.0.zip` 包含源码、配置示例、迁移、测试和文档，排除真实密钥、数据库、用户材料、邮件、依赖、构建与运行日志。M001—M004 原包保留。

项目展板业务、正式组织资料、活动内容管理、真实收款及完整生产部署继续留待后续。本轮只完成官网和未来项目入口的必要接入。

## M006 接入更新

M005 原归档维持交付时状态。当前工作区中 `/projects` 已由 M006 替换为公开演示展区，首页项目入口已改为已开放文案；项目投稿预留在 `/projects/submit`。M005 首页 URL 和认证接入不变，项目的真实上传、详情与互动后续开发。

## 统一导航修正（2026-10-09）

首页现使用全站 `SiteHeader`，顶部仅包含首页／活动／项目、语言、登录或账户、右侧菜单。组织介绍与主办内容保留正文、页脚锚点；菜单所有宽度均可展开，960px 以下默认折叠导航链接。旧 `HomepageHeader` 名称作为共享组件兼容导出保留。
## M011 兼容接入（2026-10-10）

首页结构化内容通过 content-management 发布核管理，公开页读已发布live；保存草稿不改变首页，管理员预览受限，下架恢复本模块原静态演示基线。布局及共享导航不作为自由编辑内容，原归档保留。详见 content-management README。
