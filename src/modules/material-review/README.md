## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M009 选手正式材料审核 · 1.0.0

## 当前维护摘要（2026-10-10）

- 职责：正式材料审核／附件和业务审计，不读取草稿、不发布项目。
- 公共接口：server.ts/listMaterials、getMaterial、decideMaterial；contracts.ts/http.ts；/api/admin/materials 详情/decision/files；浏览器用共享 admin client，无独立 client.ts。
- 依赖与配置：M001、M008 admin:materials、M002 正式材料／私有附件、共享 DB／写队列及 0006 业务审计；无新变量。
- 验证：material-review.test.ts、event-participation.test.ts；浏览器 playwright.material-review.config.ts 或全量 E2E。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：双修订校验；原因对本人可见，内部备注仅管理员。驳回原期可重提，通过只读、不延截止。下架后仍可后台审核正式附件；变更审计同事务；不公开项目。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

官方入口 `/admin/materials`。有效超级／运营管理员具有 admin:materials；替代原 EVENT_REVIEWER_EMAILS 业务授权，不自动将白名单账号提权。审核现有个人正式材料，不包括独立项目投稿、团队统一提交或项目公开发布。

## 接口与字段

server.ts 导出 listMaterials、getMaterial、decideMaterial。GET `/api/admin/materials?page=1&eventId=…&status=…` 返回分页列表；GET `/api/admin/materials/:id` 返回 `{material}`；POST `/api/admin/materials/:id/decision` 接收 `{revision,submittedRevision,action:'approved'|'rejected',reason,internalNote?}`，返回 `{material}`。驳回原因必填。JSON、Origin 和会话限制沿用后台约定，响应不缓存。

详情包含报名信息、official、正式引用 assets、内部备注和只读 history，不返回草稿。状态投影为 pending／approved／rejected；needs_changes 与 processed rejected 均显示驳回。开放期驳回可补充重提；accepted 仍只读。用户已确认沿用原提交截止，驳回不延长窗口，截止后不能修改／补交。保存草稿与正式资料分离，重提恢复待审核；两修订号校验防止过期审核覆盖。

GET `/api/admin/materials/:id/files/:fileId` 是独立管理员附件接口，校验审核权限及正式引用，活动下架后仍可审阅；公开活动及报名 API 此时 404。内部备注不向选手或公开目录下发，原因向本人显示。清理仍保护全部活动正式／草稿引用。

## 数据、审计与限制

0006_true_garia.sql 追加业务审计，不重置旧用户／材料。操作及前后审核快照、提交修订号、操作者、时间同事务保存；权限每请求及写事务核验。权限审计和材料业务审计分开。

验证：88 项服务通过；44 项浏览器用例经全量 43 项及旧受理用例修正后的 1 项复验通过；类型／Lint／隔离构建、生产保护 2 项及票务禁用 1 项通过。设计见 docs/M009-DESIGN.md，最终记录 docs/M009-VALIDATION.md。源码 deliverables/M009-material-review-v1.0.0.zip，不包含密钥、数据库或用户附件，全部旧包保留。生产登录和最终上线条件另行验收。
