# M009 1.0.0 · 选手正式材料审核验收

日期：2026-10-10，Asia/Shanghai。本地开发基线，与 M010、M011 同次集成验证；真实独立项目投稿审核不在范围。

## 验证与结果

- `npm run test`：88/88 服务测试通过。新增材料审核 7 项，覆盖管理员／白名单隔离、撤权、正式资料与草稿分离、驳回原因、开放期重提／截止、过期及并发审核、内部备注及审计一致性。
- `npm run test:e2e -- --output=.data/qa-admin-submodules-e2e`：44 项用例，全量 43 项通过。旧受理用例原来在已驳回正式版本上继续编辑审核，已按新规则改为先重提再审核；针对该 1 项重新运行通过。不是一次全量 44/44 的声称。新增 M009 6 项均在全量通过，覆盖真实界面审核闭环、冲突保留输入、未知网络结果核对、分页筛选／URL 恢复、普通账号拒绝、手机及键盘操作。
- 修正复验：`npx playwright test --config=playwright.admin.config.ts tests/e2e/event-participation.spec.ts -g "User registers and submits" --output=.data/qa-legacy-review-fixed`，1/1 通过。
- `npm run typecheck`、`npm run lint`、`NEXT_DIST_DIR=.next-ticket-orders-e2e npm run build` 通过。构建和浏览器夹具均隔离于正在运行的 3000 服务缓存。
- 相同构建目录下 `npm run test:production` 2/2 通过，包括所有新增后台页面／预览／API 匿名保护；`npm run test:ticketing-disabled` 1/1 通过。
- 桌面 1440px 与手机 390px 审核列表／详情及发布编辑页检查，无横向溢出；焦点、确认弹窗、双语状态与内部滚动通过浏览器流程。

## 数据与安全留存

停服追加 0006、0007 后，20 张原有表记录数和内容摘要完全一致；旧 SQL 与迁移快照按 M008 原包核对保持不变。未重置账号、会话、报名、材料、附件或订单，未通过测试赋予真实账号角色。测试使用独立 DB_PATH、私有上传目录及固定测试身份；这些运行数据不进入源码包。

每个接口和页面校验有效管理员；写事务重新校验权限和两个修订号。独立管理员附件接口只接受当前正式引用，支持下架活动审核；不泄露草稿。原受理入口也使用新数据库角色，不保留白名单授权旁路。审计只追加，审核历史保留原因及内部备注，参赛者接口仅返回公开原因。

## 集成限制

驳回仍遵守原提交截止，不自动延长；通过只读。M002 原表状态保留，新界面作 pending／approved／rejected 投影，不批量改写历史。审核通过不触发项目公开发布，团队材料仍为个人归属。管理员初始化继续采用 M008 停服 CLI；生产邮件登录仍未接入，不能据本次验收宣称生产上线。

源码：`deliverables/M009-material-review-v1.0.0.zip`，排除密钥、数据库、用户文件及测试产物。M001—M008 原包保留；新源码包 SHA256 见 `deliverables/M009-M011-SHA256.json`。
