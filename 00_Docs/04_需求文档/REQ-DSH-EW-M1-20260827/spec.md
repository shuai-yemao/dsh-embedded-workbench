# DSH Embedded Workbench M1 Spec

> 版本：v0.1
> request_id：`REQ-DSH-EW-M1-20260827`
> 项目：`D:\zhuomian\dsh-embedded-workbench`
> 基线提交：`7ebd7ff280fc124a22e77f371a9e10cc69d7260f`
> Spec 力度：`full + versioned`
> 审查状态：`approved-with-v-m1-12-deferred`
> 代码阶段判定：`实现已完成，V-M1-12 延期后进入 Final Review`

本 Spec 建立在 M0 已完成基线之上。M0 文档和证据保持冻结，不在本文件中覆盖。由于根目录已存在 M0 的 `spec.md`、`plan.md` 和 `task.md`，本 request 使用独立目录保存同名正式文档，避免跨里程碑污染历史上下文。

## 0. 目标、范围与非目标

### 0.1 目标

在每个 Cordis Host Fiber 的单次激活周期内创建一个私有 `WorkbenchLifecycle` 对象，由 Cordis 激活/卸载驱动，完成本插件内部的状态管理、资源登记、启动、失败回滚和清理。

Cordis Fiber 是框架生命周期事实源；`WorkbenchLifecycle` 不复制或暴露 Cordis 的内部状态机。

### 0.2 直接范围

- 保留 M0 单包、单 row、Host/Client 双入口、Settings section、零 Tool 和 rc.1 验收边界。
- Host `apply(ctx)` 通过薄 Adapter 创建本次激活专属的生命周期对象。
- 对象提供包内最小生命周期能力：`start()`、`dispose()` 和只读 `snapshot()`。
- 定义 `CREATED → STARTING → RUNNING → STOPPING → STOPPED` 以及 `FAILED` 状态。
- 每项资源获取后立即登记一次 disposer；按逆序清理并支持部分启动失败回滚。
- `start()`/`dispose()` 支持异步结果、幂等调用和共享 in-flight Promise。
- 输出机器可判定的后端结构化生命周期记录；不建设 M5 事件总线或日志 UI。

### 0.3 明确非目标

- 不建立通用对象注册表或跨 Fiber 共享对象。
- 不注册 Service、Driver、Provider、Consumer 或 Tool，不发布公共能力接口。
- 不引入 M2 辅助插件依赖、M4 配置/持久化、M5 事件通信。
- 不新增文件、进程、网络、串口、USB、调试器、硬件、RTOS、ISR 或 DMA 资源；仅允许生命周期清理预算使用一个可注入、一次性的受管 deadline primitive，不得形成周期或遗留后台 timer。
- 不修改官方 DSH、当前用户 profile、`mcu-workbench` 或 `embedded_framework`。
- Desktop rc.1 Loader 的 live reload/disable-re-enable seam 不在 M1 实现，延期至后续里程碑（M2+，具体环次另行定义）。
- 不声明 DSH rc.2 兼容，不把 rc.1 证据外推为版本矩阵。
- 不在 Settings UI 展示 Host 生命周期状态。

### 0.4 已确认决策

| ID | 决策 | 可信等级 |
|---|---|---|
| Q-M1-01 | 每个 Cordis Host Fiber 激活周期一个私有 `WorkbenchLifecycle`；不使用 Registry/Service/Tool/公共接口 | `user-confirmed` |
| Q-M1-02 | 启动失败自动逆序回滚；失败对象不可复活；清理错误聚合并保留 `FAILED` 与 cleanup 结果 | `user-confirmed` |
| Q-M1-03 | `start()`/`dispose()` 幂等并共享 in-flight Promise；启动中 dispose 禁止进入 RUNNING；终态不可复活 | `user-confirmed` |
| Q-M1-04 | 支持异步清理；生命周期总清理预算暂定 1000 ms；超时进入 `FAILED`，不强杀进程、不自动重试 | `user-confirmed` |

### 0.5 延期决策

用户已确认将 `B-04 / V-M1-12` 的 Desktop rc.1 Loader live reload/disable-re-enable 能力延期至后续里程碑（M2+，具体环次待后续 Spec 指定）。该项不再阻塞 M1 Final Review；M1 继续保持“不修改官方 DSH、当前用户 profile 和产品公共接口”的边界。

## 1. 工程现状表

| ID | 已知事实 | 证据 | 可信等级 | 影响范围 | 补证动作 |
|---|---|---|---|---|---|
| F-M1-01 | M0 已完成，9/9 Task、Verify 和 Final Review 通过 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/state.json:190-203`；`events.jsonl:36-37` | `confirmed` | M1 回归基线 | 保留 M0 证据 |
| F-M1-02 | 当前 Host 只有无状态 `apply()` 和加载标记 | `src/index.js:1-5` | `confirmed` | M1 Host Adapter | 新增私有生命周期模块 |
| F-M1-03 | 当前 Client Settings section 已由 `ctx.effect()` 对称清理 | `src/client.js:19-31` | `confirmed` | M0 Client 回归 | 不与 Host 对象合并 |
| F-M1-04 | Cordis 支持插件对象/函数/class、Fiber、effect、异步 disposer 和 await/restart | `F:\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\lib\index.js:1002-1022,1168-1277,1393-1414` | `confirmed` | Adapter 兼容 | 不依赖 `internal/*` 作为公共 API |
| F-M1-05 | 单个 effect 的 disposer 可逆序执行；多个独立 effect 卸载可能并行 | `F:\DSH Desktop\resources\app\node_modules\@deepseek-ai\cordis\lib\index.js:1174-1183,1371-1389` | `confirmed` | 资源栈设计 | 顺序相关资源必须放入同一组合 disposer |
| F-M1-06 | Desktop rc.1 是当前运行基线；profile-local rc.2 依赖闭包仍损坏 | M0 T-006/T-009 运行记录；M0 state `verify_summary` | `confirmed` | Loader 验收 | M1 不声明 rc.2 |
| F-M1-07 | M1 不涉及 MCU/硬件和嵌入式五层实现 | M0 Spec `spec.md:62-89`；当前仓库目录与包 manifest | `confirmed` | 目标板/实物 | 标记 `not_applicable` |
| F-M1-08 | 当前 `package.json.files` 只包含四个产品文件，私有模块尚未纳入 | `package.json:15-19` | `confirmed` | 打包契约 | `files` 增加私有模块，`exports` 保持四项 |

## 2. 文件施工清单

| ID | 动作 | 文件/目录 | 所属边界 | 施工内容 | 前置事实 | 状态 |
|---|---|---|---|---|---|---|
| W-M1-01 | 修改 | `src/index.js` | Host Adapter | 创建本次 Fiber 激活专属对象，绑定 `start()` 与 Cordis disposer | F-M1-02/F-M1-04 | `ready-after-H-02` |
| W-M1-02 | 新增 | `src/workbench-lifecycle.js` | Plugin internal | 私有状态机、资源栈、错误聚合、幂等异步清理和只读快照 | Q-M1-01..04 | `ready-after-H-02` |
| W-M1-03 | 修改 | `package.json` | Package | 保持 M0 exports；私有模块进入 `files`，不作为公共 export；不增加 Tool/Service 依赖 | F-M1-06/F-M1-08 | `ready-after-H-02` |
| W-M1-04 | 新增/修改 | `test/lifecycle.test.js`、现有 M0 tests | Verification | 状态、故障注入、并发、资源所有权和 M0 回归 | F-M1-01..05 | `ready-after-H-02` |
| W-M1-05 | 新增 | `scripts/verify-m1.ps1` | Verification tooling | 只读检查生命周期契约、M0 边界和日志快照 | F-M1-01/F-M1-06 | `ready-after-H-02` |
| W-M1-06 | 不建议动 | `src/client.js`、`cordis.patch.yml` | M0 boundary | 保持 Settings section 和单 row 契约，除非回归证明必须调整 | F-M1-01/F-M1-03 | `locked` |
| W-M1-07 | 不建议动 | 当前用户 profile、官方 DSH、`embedded_framework` | External boundary | M1 不写入、不修改、不安装生产 profile | F-M1-06/F-M1-07 | `locked` |

## 3. 代码生成约束清单

| ID | 约束类别 | 已确认约束 | 证据 | 禁止事项 | 状态 |
|---|---|---|---|---|---|
| G-M1-01 | 对象边界 | 每次 Fiber 激活周期最多一个私有生命周期对象 | Q-M1-01 | 模块级 singleton、跨 Fiber 共享、公共 export | `ready` |
| G-M1-02 | 框架边界 | Cordis Fiber 管理激活/卸载；产品对象不复制/暴露 Fiber 内部状态 | F-M1-04 | 依赖 `internal/status` 作为公共契约 | `ready` |
| G-M1-03 | 状态 | 状态迁移必须合法、可观测；`STOPPED`/`FAILED` 对象不可复活 | Q-M1-02/Q-M1-03 | 静默状态跳转、失败后原地重启 | `ready` |
| G-M1-04 | 所有权 | 资源创建后立即登记 disposer；由同一对象统一持有并逆序释放 | F-M1-05/Q-M1-02 | 依赖多个 effect 的全局释放顺序 | `ready` |
| G-M1-05 | 失败 | 启动主错误必须保留；清理错误聚合；部分启动失败必须回滚 | Q-M1-02 | 吞错、跳过后续清理、覆盖根因 | `ready` |
| G-M1-06 | 并发 | start/ dispose 幂等并共享 in-flight Promise；启动中 dispose 不得进入 RUNNING | Q-M1-03 | 重复获取、重复释放、终态复活 | `ready` |
| G-M1-07 | 超时 | 异步清理总预算 1000 ms；允许一次性受管 deadline primitive；超时记录稳定错误码并保留残留信息 | Q-M1-04 | 无限等待、周期/遗留 timer、强杀进程、自动重复 disposer | `ready` |
| G-M1-08 | API | `start()`、`dispose()`、只读 JSON-safe `snapshot()` 为包内接口；不注册 Service/Tool | Q-M1-01 | 公共能力接口、`ctx.provide()`、`defineTool()` | `ready` |
| G-M1-09 | 资源 | M1 只允许有界状态和测试 Fake 资源；deadline primitive 必须由对象拥有、可取消且清理完成后释放 | M1 非目标 | 文件/进程/网络/串口/硬件访问、周期 timer、遗留后台任务 | `ready` |
| G-M1-10 | 兼容 | 运行验收固定 Desktop DSH rc.1 + Cordis 4.0.1；rc.2 为排除项 | F-M1-06 | 用 rc.1 证据宣称 rc.2 兼容 | `ready` |

## 4. 验收测试清单

| ID | 证据等级 | 验收项 | 条件/故障注入 | 预期结果 | 状态 |
|---|---|---|---|---|---|
| V-M1-01 | 静态/主机 | M0 边界回归 | `npm test`、`verify:m0`、manifest 扫描 | 单 row、Settings、零 Tool 和包边界保持 | `not-run` |
| V-M1-02 | 主机 | 正常状态转换 | start 一次、dispose 一次 | `CREATED→STARTING→RUNNING→STOPPING→STOPPED`，每次只记录一次 | `not-run` |
| V-M1-03 | 主机 | 每 Fiber 一个实例 | 两个 Fiber、同一 Fiber reload | 实例隔离；reload 创建新对象；旧对象不可用 | `not-run` |
| V-M1-04 | 主机 | 逆序清理 | Fake 资源 A/B/C | C/B/A 各清理一次，资源计数归零 | `not-run` |
| V-M1-05 | 主机 | 启动失败回滚 | B 创建失败 | A 回滚、C 不创建、保留启动根因、状态 FAILED | `not-run` |
| V-M1-06 | 主机 | 清理错误聚合 | B disposer throw/reject；晚到 reject | A/B/C 均尝试，记录 cleanup_errors；晚到结果不改写终态且无 unhandled rejection | `not-run` |
| V-M1-07 | 主机 | 幂等并发 | 并发 start、并发 dispose；严格比较 Promise 身份 | 共享同一 Promise；底层创建/释放各执行一次；后续 dispose 不重复调用 | `not-run` |
| V-M1-08 | 主机 | start/dispose 竞态 | STARTING 中触发 dispose | 不进入幽灵 RUNNING；晚到资源被回滚 | `not-run` |
| V-M1-09 | 主机 | 终态保护 | STOPPED/FAILED 后 start/register | 返回稳定 terminal/invalid 错误，不创建资源 | `not-run` |
| V-M1-10 | 主机 | 清理超时 | disposer 永不 resolve、晚到 resolve、晚到 reject | 1000 ms 内记录 timeout；状态 FAILED；残留可定位；晚到结果不复活、不重试 | `not-run` |
| V-M1-10a | 静态/主机 | 私有模块打包契约 | `npm pack --dry-run --json` | tarball 含 `src/workbench-lifecycle.js`；`exports` 仍为四项且无生命周期子路径 | `not-run` |
| V-M1-11 | 主机/真实 Cordis | Adapter | `ctx.plugin()`、`fiber.await()`、`fiber.dispose()` | apply 创建对象；启动错可观察；cleanup 由 Fiber 接管 | `not-run` |
| V-M1-12 | Desktop rc.1 runtime | Loader reload | 同一受控 Loader 生命周期中触发 disable/re-enable 或明确 loader update | 先观察旧 `instance_id` 的 STOPPING 与 STOPPED/FAILED，再允许新实例 STARTING/RUNNING；日志可成对关联 | `deferred-to-following-milestone` |
| V-M1-13 | Desktop rc.1 runtime | M0 UI/工具回归 | Settings、工具快照、精确 remove | UI 保持；工具 added/removed 为空；其他 bundle/hash 不变 | `not-run` |
| V-M1-14 | 目标板/实物 | MCU/硬件验证 | 不适用 | 记录 `not_applicable`，不得外推硬件结论 | `not_applicable` |

生命周期结构化记录至少包含：`instance_id`、`operation`、`from`、`to`、`result`、`error_code`、`duration_ms`、`cleanup_complete`、`remaining_resource_count`。

补充约束：1000 ms 是整个 cleanup 的总预算，而非每个 disposer 的预算；超时只结束主等待链，不会取消底层 Promise。超时后的 disposer 必须继续挂接 `catch/finally`，晚到 resolve/reject 只能更新诊断，不能改写终态、重试或产生未处理 rejection。无法被 JavaScript 抢占的同步阻塞 disposer 不属于可实现的超时保证，必须在测试中排除。`STARTING × dispose()` 的握手为：`dispose()` 先同步设置 `stopRequested` 并创建/复用唯一 cleanup Promise，等待 `startPromise` settle 后加入同一 cleanup；`start()` 每次 await 后检查 `stopRequested`，不得等待 `disposePromise`，从而避免互等死锁。`start()` 失败时必须在自身重抛前完成回滚，因为 Cordis 尚未取得返回的 disposer。

`snapshot()` 必须返回深复制或深冻结的 JSON-safe 数据，不得包含 `ctx`、Fiber、Promise、disposer、原始 `Error` 或可变资源数组；`instance_id` 由生命周期对象生成，不读取 `ctx.fiber.uid`。Host Adapter 应以单一组合 disposer 绑定：先创建对象并 `await lifecycle.start()`，成功后返回 `() => lifecycle.dispose()`；不得将有顺序依赖的资源拆成多个顶层 effect。

## 5. 目的与可行性质疑

### 5.1 目的结论

M1 解决的是“插件已经能加载，但没有受控的内部运行实例和资源生命周期”这一问题，不是提前建设完整工作台能力。对象边界已由用户确认，目的结论为 `user-confirmed`。

### 5.2 可行性结论

在 Desktop DSH rc.1、Cordis 4.0.1 和当前单包结构下，Cordis 已提供 Fiber、effect、异步 disposer、await/restart 等必要机制，M1 为 `可行`。rc.2 兼容、真实外部资源和硬件仍不在本轮声明内。

## 6. 风险、回滚与代码阶段判定

| 风险 | 影响 | 处理 |
|---|---|---|
| 产品状态复制 Cordis 状态 | 两套状态不一致 | Fiber 是装载/激活/卸载事实源；Lifecycle 状态只描述本插件私有资源阶段，二者不要求名称或时刻一一对应 |
| 多 effect 清理并行 | 顺序相关资源残留 | 单一组合 disposer 栈、逆序清理 |
| 清理错误被框架吸收 | 外部无法判断失败 | Lifecycle 保存结构化 cleanup 结果 |
| 异步竞态 | 重复创建或释放 | 共享 in-flight Promise、终态不可复活 |
| rc.2 依赖闭包损坏 | 运行入口不可复现 | 只声明 rc.1，另建版本治理任务 |
| Desktop rc.1 Loader reload seam 缺失 | V-M1-12 无法在 M1 运行环境完成 | 延期至后续里程碑；M1 不修改官方 DSH 或用户 profile |

回滚只允许以 `7ebd7ff280fc124a22e77f371a9e10cc69d7260f` 为锚点恢复 M1 修改的 `src/index.js`、`package.json`、M0 verifier/tests，并删除 M1 新文件；运行环境只允许使用项目内隔离 `DSH_HOME` 执行官方精确 remove，复核 dependency/bundle/row、client 404、Settings 消失、端口释放和受保护 profile 哈希。不得回退 M0 基线、覆盖用户 profile 或删除历史证据。

**代码阶段判定：** M1 实现已完成。`V-M1-12` 按用户决策延期，不作为本轮 Final Review 的阻塞条件；其余 M1 范围仍需完成最终验证。

## 7. 下游交接

- 当前状态：`approved-with-v-m1-12-deferred`。
- 下一步：继续 `workflow-final-review`；V-M1-12 作为后续里程碑输入，不在本轮实现。
- Plan 可先以 `awaiting_user_review` 草案保存；不得生成 Task 或修改实现，直到 H-02/H-03 通过。
- 新事实若改变对象边界、状态、权限、资源、并发或验收，必须回到 Router/Challenge/Review Gate。
- M0 证据基线：`.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/`。
