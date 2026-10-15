## 独立副本品牌更新 2026 年 10 月 14 日

本副本沿用原业务契约与数据归属，统一 ATOX 品牌、共享导航和中性线性视觉。此次变更与限制见 docs/INDEPENDENT_REBUILD.md。下文原验收记录是上游历史基线，不代表本次新增验证。

# M003 模拟购票与我的订单

## 当前维护摘要（2026-10-10）

- 职责：开发演示选票、问卷、订单、模拟支付和本人订单列表。
- 公共接口：server.ts 目录／报价／订单／支付／通知／维护；client.ts/ticketRequest、contracts.ts；/api/preview/ticketing/demo；provider.ts 独立渠道适配。
- 依赖与配置：M001、共享 DB／写队列、语言／导航；ENABLE_TICKETING_PREVIEW、独立 TICKETING_WEBHOOK_SECRET、APP_ORIGIN、DB_PATH。
- 验证：ticketing.test.ts、ticketing-races.test.ts；浏览器 ticketing.spec.ts、ticketing-ui.spec.ts、ticket-orders.spec.ts；两个禁用套件。服务文件用 `npx tsx --test tests/<文件>`，浏览器文件用 `npx playwright test tests/e2e/<文件>`；完整命令／隔离见 [运维](../../../docs/OPERATIONS.md)。
- 集成限制：当前 1.2 包含菜单和订单页，生产始终 404，不收款／银行卡或提供参赛资格。0002/0003 及快照保留；未知先查单、确认关闭才释放、迟到成功待对账。维护先停同库网站；1.0/1.1 记录是历史。

以下原交付记录保留历史语境；当前依赖和行为以上述摘要及最新接入段落为准。实际当前验证见 [仓库验收](../../../docs/REPOSITORY-VALIDATION.md)，原 zip 仅本地留存，源码使用 Git 追溯。

版本 1.2.0，本地模拟闭环。仅供 development 显式开启，右上角展开菜单临时提供“购票（模拟）”入口；不接 M002 参赛资格、真实收款、退款或出票核销。所有支付均为模拟，不发生真实扣款。

## 页面、配置与运行

选票页 `/preview/ticketing/demo`，问卷／订单页 `/preview/ticketing/demo/checkout`，历史订单页 `/preview/ticketing/demo/orders`；未登录购买进入 M001 登录并通过安全 next 返回。三页复用 HACKATHON 导航和简洁页脚，深色卡片、紫色强调、荧光绿主按钮，桌面双栏／手机单栏、中英文；票种展示每账号最多 5 张，当前不展示账号动态剩余额度。服务端仍严格执行账号限额。

| 配置                       | 规则                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `ENABLE_TICKETING_PREVIEW` | 默认 false；只有 NODE_ENV=development 且精确为 true 才开放；当前本地已开启，归档示例默认关闭 |
| `TICKETING_WEBHOOK_SECRET` | 模拟通知签名密钥，至少 32 字符，服务端使用；未配置支付返回 PAYMENT_NOT_CONFIGURED（503）     |
| `APP_ORIGIN` / `DB_PATH`   | 沿用共享同源限制和单进程 PGlite；保留已有数据                                                |

在 `.env.local` 配置开发开关及自行生成的签名密钥后重启 `npm run dev`，可从右上角展开菜单或独立 URL 访问。关闭开关或 production 时，页面和全部接口均不可用（404），即使 production 显式配置开关也不会开放。

`config.ts` 中金额单位为 CNY 分：早鸟 4900、标准 9900，库存各 100，账号累计上限 5 张，订单预留 15 分钟。早鸟开放区间为 2026-10-01 至 2026-11-01，标准为 2026-10-01 至 2027-01-01；时区 Asia/Shanghai，截止不包含。活动、政策、联系人与问卷选项均为演示配置，不代表正式活动。问卷为显示名称、国家或地区、获知渠道单选、目的多选、备注及政策确认；备注可选。

## 公共入口与 HTTP 契约

`server.ts`：getCatalog、quote、createOrder、getOrder、listOrders、startPayment、closeOrder、simulatePayment、handleNotification、maintainOrders、isTicketingEnabled、TicketingError。`client.ts`：ticketRequest 和 TicketError；`contracts.ts` 为浏览器共享 DTO。金额、政策、问题及活动信息随订单快照保存。

API 前缀 `/api/preview/ticketing/demo`，响应不缓存；错误 `{ error, orderId?, quote? }`。JSON 请求限 64 KiB。除目录与签名通知外均需 M001 会话且只能操作自己的订单；用户修改请求验证 APP_ORIGIN。

| 方法／路径                  | 契约                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET `/`                     | CatalogDto，票态、可用库存、问题、活动、服务端时间                                                          |
| POST `/quote`               | QuoteInput：ticketId、quantity、answers → QuoteDto，含 quoteVersion                                         |
| POST `/orders`              | QuoteInput + quoteVersion + idempotencyKey → OrderDto                                                       |
| GET `/orders?page=1` | OrderListDto，仅当前账号／当前活动，创建时间倒序，每页 10 条 |
| GET `/orders/:id`           | OrderDto，刷新状态并恢复订单                                                                                |
| POST `/orders/:id/payments` | 启动／恢复模拟支付 → OrderDto                                                                               |
| POST `/orders/:id/close`    | 安全关单 → OrderDto；必须确认 closed 才能改票                                                               |
| POST `/orders/:id/simulate` | `{ action }`，success / failure / cancel / unknown / duplicate / late_success → OrderDto                    |
| POST `/payments/notify`     | 原始 JSON + x-ticketing-signature HMAC-SHA256 → `{ ok: true }`；独立签名验证，不依赖用户会话或浏览器 Origin |

通知核对订单、支付尝试、交易、金额及币种，并回查持久化模拟交易状态；新通知时间窗口 5 分钟。同一事件重复投递幂等，事件 ID 相同而内容不同拒绝。

## 状态、故障与恢复

- 票态：not_open、on_sale、ended、sold_out、disabled。
- 订单：pending、paid、closed；过期以 closed + closeReason=expired 表示，不是额外订单枚举。
- 预留：held、converted、released。支付成功从预留转销售；确认安全关闭才释放库存。已付款及仍待处理订单共同约束账号额度。
- 支付持久化尝试：creating、pending、succeeded、failed、cancelled、closed。DTO 另含 idle，以及通过 PROVIDER_UNKNOWN 映射的 unknown。失败／取消不直接等于关单；允许动作以 canPay、canClose 和服务端结果为准。
- 不确定结果不能立即释放库存；关单先查询／关闭模拟交易，再决定订单及预留。安全关单失败或结果不明时保留当前订单，不能前端清空后另购。刷新恢复状态及原到期时间，不延长预留。
- 已关闭订单收到迟到成功，保留 closed 并标记 reconciliationRequired，不重新扣减库存、不自动开通资格或声称已退款。人工对账／真实退款不在本模块实现范围。
- QUOTE_CHANGED（409）带新报价，需重新确认；PENDING_ORDER_EXISTS（409）带现有订单 ID，恢复该单；ACCOUNT_LIMIT、INSUFFICIENT_STOCK、ORDER_NOT_PAYABLE 等错误明确反馈。幂等键同请求重试返回原单，不同请求拒绝 IDEMPOTENCY_CONFLICT；幂等别名表保持多键恢复关系，不重复预留或下单。

开发模拟面板独立标示无真实扣款，支持成功、失败、取消、不确定、重复及迟到成功，用于验证故障恢复，不能作为真实渠道接入证明。

## 数据与维护

模块拥有 ticket_inventory、ticket_orders、ticket_order_keys、ticket_reservations、ticket_payment_attempts、ticket_payment_notifications、mock_payment_transactions；使用共享数据库连接和写队列。追加迁移 `0002_stormy_black_bird.sql`、`0003_clumsy_vertigo.sql`（幂等别名表），不改写旧迁移、不重置数据。

订单及支付关联记录使用 restrict 外键，财务记录不随用户删除级联清除。维护命令只推进状态与回收安全释放的预留，不删除财务历史。不通过删表、删除订单或重置库存处理故障。

**先停止占用相同 DB_PATH 的开发／生产服务，再运行维护或迁移；PGlite 同一目录仅允许单进程访问。**

```powershell
npm run db:migrate
npm run ticketing:maintain
```

维护脚本读取 `.env.local`；package command 显式设置 NODE_ENV=development，仍需 ENABLE_TICKETING_PREVIEW=true。输出 checked、closed、paid、unknown；unknown 表示仍需继续确认，不能作为安全释放凭据。目录、报价及订单刷新也会推进相关维护，不等同已部署后台定时任务。

## 验证与留存

运行测试与构建前先停止已有开发服务，避免 Next 构建锁及 PGlite 单进程冲突；生产测试前先构建。

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:ticketing-disabled
npm run build
npm run test:production
```

安全断言覆盖未配置签名密钥返回 503、零价订单不启动渠道、签名通知不能伪造模拟渠道已支付状态、新通知 5 分钟限制及同事件旧通知幂等重放。实际数据库追加迁移前后 8 张认证／报名相关表记录数全部一致；维护 CLI 实测成功。桌面与手机截图已查看，无横向溢出。

1.0.0 历史验收：typecheck、lint、build 均通过；服务测试 35 项（原模块与返回路径 18、票务 13、竞态 4）、E2E 9 项（原 6、票务 3）、开发关闭开关独立测试 1 项及生产测试 1 项均通过。开发 flag=false 时全部票务 API 和两页 404；生产 flag=true 时仍全部 404。npm audit --omit=dev 为 0 漏洞。

源码归档 `deliverables/M003-ticketing-v1.0.0.zip` 已生成，保留原 M001／M002 包不变。允许无真实密钥的 `.env.example`，排除真实环境配置、数据库、用户数据、上传资料、邮件、依赖及构建产物。真实支付适配、部署、调度、对账处置、退款和全站整合均为后续工作。


## 1.1.0 · 菜单与我的订单

新增 `/preview/ticketing/demo/orders`，选票、结算和订单页共享“购买门票／我的订单”导航。未登录跳转 M001 并保留安全站内 next；登录失效后刷新列表会清除旧数据并返回登录。

主站菜单入口仅展开时可见，双语“购票（模拟）／Tickets (Demo)”。服务端按 `isTicketingEnabled()` 判断，通过 `SiteNavigationProvider` 只下发布尔能力，不将模拟密钥或私有环境变量送到浏览器。关闭开关或生产环境均不渲染入口，服务端页面／接口保护仍独立生效。

`listOrders(user, page)` 先刷新当前用户在当前演示活动下的 pending 订单，再查询列表；不调用全站维护函数，渠道调用期间不占写锁。列表采用 createdAt 倒序、同值 ID 倒序，每页 10 条；返回 `orders`、`total`、`page`、`pageSize`、`totalPages`。API 页码须为正整数且偏移在安全整数范围内，否则 400；未知参数（包括 userId）或重复 page 均 400。页面非法页码归一为 1；超出页数显示空页及返回第一页入口。

`OrderSummaryDto` 白名单字段：id、eventId、eventName、ticketName、quantity、totalAmount、currency、createdAt、status、paymentStatus、reconciliationRequired、canPay、timeZone。活动、票种和时区来自历史快照，金额使用保存的订单金额；不返回邮箱、问卷答案、幂等键、签名或渠道内部记录。响应 no-store。

列表显示待支付／已支付／已关闭；pending 且渠道创建中、处理中或未知时显示“确认中”；reconciliationRequired 优先显示“待对账”。不会凭前端倒计时关闭订单或宣称购票成功。允许付款且没有确认中／对账提示时显示“继续支付”，所有订单可查看现有 checkout?orderId 详情；现有支付恢复、查询及关单规则继续生效。

刷新、网络失败重试、分页、空状态、双语和手机布局可用，不添加退款、删除、出票、核销或其他财务动作。复用原订单、库存、支付表和迁移；既有订单与账号保留，无新增配置。

1.1.0 验收见 `docs/M003-1.1-VALIDATION.md`；源码归档为 `deliverables/M003-ticketing-v1.1.0.zip`，保留 1.0.0 及其他模块原归档。归档排除密钥和运行数据。

## 1.2.0 · 主站样式与精简结算

三页通过开发预览布局复用共享 Header／Footer 和认证公开服务，ATOX 品牌、顶部菜单、语言及账户一致。活动标题仍来自活动配置及订单快照。模块样式限定在 `.tk-module`／`.tk-confirm-dialog`，继承黑色、暖白与珊瑚红视觉；桌面双栏、手机单栏，报价未确定前的金额标注预估。确认弹窗持有明确的触发按钮引用，取消或 Escape 关闭后将焦点返回该按钮，避免内部自动聚焦影响键盘操作。

`components/use-checkout.ts` 负责浏览器结算状态：资料满足已有规则后 500 毫秒防抖请求报价，不预留库存；资料变化立即清除旧报价并取消旧请求，通过输入指纹和请求序号拒绝迟到响应。报价加载、失败或缺少政策同意时不能下单，支持重试且保留输入。发现已有未完成订单仅提供明确的继续入口，不自动付款。

“确认订单并模拟支付”顺序使用原订单和支付接口；报价提前自动获取，不新增合并 API。订单返回后先保存 ID 并用 Next.js 支持的原生 history.replaceState 同步提交订单地址，再发起支付，防止立即刷新停留在原资料链接。操作用同步锁防止双击；已付、已关闭、渠道处理中、未知或需对账的订单不会自动启动新的付款。

提交前在按活动及账号隔离的 sessionStorage 保存完整 CreateOrderInput 和幂等键。网络／服务端未知结果保留该请求并禁止编辑重下；刷新可恢复“核对下单结果”。核对先 GET 本人订单列表，有 pending 则读取其详情；否则用原输入、原幂等键恢复原请求。核对成功只进入订单，不自动付款。明确失败的原内容重试仍复用原键，资料或报价版本变化才生成新键。支付发起失败保留原订单，先刷新服务端状态，确认可支付后开放继续按钮。

QUOTE_CHANGED 展示新摘要并停止支付；政策文本变化清除同意项，重新阅读勾选后报价才恢复。历史订单始终显示已保存政策与资料。改票通过模块内原生 dialog 确认，支持 Esc、焦点约束及关闭恢复；关单结果不确定时不导航、不自行释放库存。

开发模拟器使用可折叠 details；发起支付或恢复渠道处理中订单时展开。成功、失败、取消、未知、重复通知和迟到收款由原服务端模拟器处理，浏览器不能直接修改订单成功。原页面、API、DTO、数据库、迁移、开发开关及账号数据继续兼容；无新依赖或业务环境变量。

验收记录 `docs/M003-1.2-VALIDATION.md`，源码归档 `deliverables/M003-ticketing-v1.2.0.zip`；保留所有既有归档，排除真实环境和运行数据。
