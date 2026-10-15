## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# 结构化发布核：M010 活动发布与 M011 官网内容管理

## 当前维护摘要（2026-10-10）

- 职责：两业务共用结构化草稿、已发布 live、授权预览／下架及业务审计。
- 公共接口：server.ts/getManagedContent、listManagedEvents、createManagedEvent、changeContent、readPublishedEvent/readPublishedHomepage；contracts/rules；组件用共享 admin client；store.ts 内部读取和事务复查核。
- 依赖与配置：M001、M008 admin:content、M004/M005 静态默认、共享 DB／写队列和 0006 审计；0007 managed_content；无独立变量。
- 验证：content-management.test.ts；浏览器 content-management.spec.ts，及活动／报名／组队／首页消费模块回归。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：M002/M007 运行用异步发布配置、事务复查，旧同步入口不得绕过下架。活动下架隐藏公众但保留数据；首页撤回回退示例。稳定 ID、限定原创封面、不上传任意 URL；不自由编辑脚本、不自动公开材料。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

两个独立业务模块共用本目录发布核，版本均 1.0.0；职责及公开读取分开，不把材料审核与发布绑定。有效管理员需 admin:content，公开用户不能访问草稿、预览或业务审计。

## M010 活动发布

`/admin/events` 列出三个存量基线及新增持久化活动；创建只接受稳定 slug ID，复制 demo 模板成为草稿，不直接发布。`/admin/events/:eventId` 编辑双语名称／主题／介绍／主办方／地点、时区和六个带偏移 ISO 时间、赛道／规则、推荐及演示标记。封面仅选择 demo.svg、upcoming-demo.svg、past-demo.svg 三张原创 SVG，不接受任意 URL 或上传。ID 创建后不可变，fileRules／participantCenter 保留。

`/admin/events/:eventId/preview` 仅管理员查看已保存草稿。发布后公开看板、详情及参赛运行配置读数据库发布源；下架后全部公众活动页面／报名等 API 404，但旧数据保留，管理员审核及独立附件接口仍可用。赛道引用保护及推荐冲突由服务端校验，不能发布破坏有效材料引用的配置。

## M011 官网内容管理

`/admin/content/homepage` 编辑结构化双语文本、三项主办方向和 metadata；`/admin/content/homepage/preview` 查看已保存草稿。保存不影响公开首页，发布才切换 live；下架恢复原静态演示首页。没有任意 JSON／脚本编辑、拖拽布局或假上传。共享导航和用户身份不是可编辑内容。

## 共用接口与版本

GET `/api/admin/content/events` → `{items}`；POST 同路径 `{id}` → `{content}`。

GET `/api/admin/content/events/:eventId` 或 `/api/admin/content/homepage` → `{content,history}`；PUT 同路径 `{revision,action:'save',draft}`；POST 同路径 `{revision,action:'publish'|'withdraw'}` → `{content,history}`。

ContentRecord 为 id、kind、revision、state(draft/published/withdrawn)、draft、live、updatedAt、publishedAt、updatedBy。存量虚拟基线 revision=0，须保存后预览／发布；变更递增修订，草稿与 live 分离。发布／下架使用确认弹窗，409 保留输入并锁写；网络结果未知同样锁写，显式重新读取核对后才能继续。未保存离开提醒，审计只读展示前后内容。

server.ts 导出 getManagedContent、listManagedEvents、createManagedEvent、changeContent、readPublishedEvent、readPublishedHomepage；0007_common_umar.sql 新增 managed_content，沿用 0006 业务审计、共享连接和写队列。授权与变更审计同事务；停服后才可用相同 PGlite 目录执行迁移，不重置数据。

运行时 event-board/server.getEventConfig 为异步发布源；M002 resolveEvent／resolveFiles、M007 resolveCenter 使用发布配置，写事务复查。旧同步配置查询及 forEvent／forCenter 保留静态兼容测试用途，不自动查询数据库，生产路由不能依靠这些旧入口绕过下架或窗口变更。

验证：88 项服务，44 项浏览器用例经全量 43 项及修正旧受理流程后的 1 项复验通过；类型／Lint／隔离构建、生产保护 2 项及票务禁用 1 项通过。不宣称完整生产上线。设计见 docs/M010-DESIGN.md、docs/M011-DESIGN.md；验收见 docs/M010-VALIDATION.md、docs/M011-VALIDATION.md。分别留存 deliverables/M010-event-management-v1.0.0.zip、M011-homepage-management-v1.0.0.zip，旧包保留。真实项目投稿审核、封面上传、拖拽布局、真实支付及飞书不在本轮。
