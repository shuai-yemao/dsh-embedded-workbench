# M1 集成实施计划：私有 WorkbenchLifecycle

> 本计划对应 `REQ-DSH-EW-M1-20260827`，只覆盖 M1 Spec 已确认范围。
> M0 根目录 `spec.md`、`plan.md`、`task.md` 为历史基线，保持不覆盖。

## 1. 元数据与状态

| 字段 | 内容 |
|---|---|
| request_id | `REQ-DSH-EW-M1-20260827` |
| 生成时间 | `2026-08-27T00:00:00+08:00` |
| 计划版本 | `v0.1` |
| 计划状态 | `approved-with-v-m1-12-deferred` |
| 项目路径 | `D:\zhuomian\dsh-embedded-workbench` |
| 分支/提交 | `main / 7ebd7ff280fc124a22e77f371a9e10cc69d7260f` |
| 输入 spec.md | `D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M1-20260827\spec.md` |
| 输入 Review-Package | `D:\zhuomian\dsh-embedded-workbench\.mcu-workbench\workflows\REQ-DSH-EW-M1-20260827\state.json` |
| Spec 力度 | `full` |
| 风险叠加门禁 | `versioned` |
| 选定方案 | `方案 A` |
| 方案选择人 | `user` |
| 用户审查状态 | `approved` |
| 方案审查结论 | `V-M1-12 延期至后续里程碑，M1 继续 Final Review` |

## 2. 一句话说明

- 要解决的问题：M0 只有无状态 Host `apply()`，没有受控的插件内部运行实例和资源生命周期。
- 计划做什么：在每个 Cordis Host Fiber 激活周期内，由薄 Host Adapter 创建一个私有 `WorkbenchLifecycle`，实现状态、资源登记、启动、失败回滚和清理。
- 明确不做什么：不建全局 Registry，不注册 Service、Tool 或公共能力接口，不接入 M2-M5、外部 I/O、硬件或 rc.2。
- 预期结果：同一 Fiber 激活期只有一个对象；卸载可逆序清理；并发调用幂等；失败和超时均有结构化诊断；M0 Settings/零 Tool 契约不回归。1000 ms 为整个异步 cleanup 的硬 deadline，超时保留残留诊断，不取消或重试底层 disposer。

## 3. 输入依据与工程事实

| ID | 事实或约束 | 证据（文件/配置/命令） | 可信等级 | 对计划的影响 |
|---|---|---|---|---|
| E-M1-01 | M0 9/9 Task、Verify、Final Review 已通过 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/state.json`；M0 `events.jsonl` | `confirmed` | 先建立回归基线，不能重写 M0 历史 |
| E-M1-02 | 当前 Host 只有无状态 `apply()` 和加载标记 | `src/index.js:1-5` | `confirmed` | 只在 Host 入口增加 Adapter |
| E-M1-03 | Client Settings 已通过 `ctx.effect()` 对称清理 | `src/client.js:19-31` | `confirmed` | `src/client.js` 锁定，不与 Host 生命周期对象合并 |
| E-M1-04 | Cordis 提供 Fiber、effect、异步 disposer、await/restart | Desktop rc.1 Cordis `lib/index.js` 对应 Fiber/effect/await 实现 | `confirmed` | 使用公开宿主生命周期，不依赖 internal 状态 |
| E-M1-05 | 单个 effect 的 disposer 可逆序执行，独立 effect 可能并行卸载 | Cordis `lib/index.js` disposer 实现 | `confirmed` | 相关资源统一进入单一组合 disposer 栈 |
| E-M1-06 | Desktop rc.1 是 M1 运行基线；profile-local rc.2 依赖闭包损坏 | M0 T-006/T-009 运行记录与 M0 state | `confirmed` | 只验收 rc.1，rc.2 继续列为排除项 |
| E-M1-07 | M1 不涉及 MCU、RTOS、硬件或实物资源 | M1 Spec §0.3、§1 | `confirmed` | 目标板/实物验证标记 `not_applicable` |
| E-M1-08 | 包 `files` 当前未包含新私有模块 | `package.json:15-19` | `confirmed` | 施工时必须保证私有模块进入发布包，但不增加 export |
| E-M1-09 | M0 的部分断言按四文件包快照实现，M1 合法增加私有模块后需改为语义不变量 | `test/package-contract.test.js`、`test/verify-m0.test.js`、`scripts/verify-m0.ps1` | `confirmed` | M0 回归允许 files 增加一个私有文件，但 exports、row、Settings、零 Tool 不变 |

## 4. 两个候选方案与用户选择记录

### 方案 A：薄 Adapter + 单一私有生命周期模块

- 适用场景：M1 只需要一个 Host 生命周期对象，优先保持最小改动和清晰回滚。
- 做什么：修改 `src/index.js` 创建对象并把 `dispose()` 交给 Cordis；新增 `src/workbench-lifecycle.js` 封装状态机、资源栈、错误聚合和快照；测试通过 Fake 资源覆盖竞态和故障。
- 主要改动：`src/index.js`、`src/workbench-lifecycle.js`、`package.json` 的 `files`、M1 单测和验证脚本。
- 优点：对象边界单一，能直接映射 M1 Spec；清理顺序集中，运行时额外层次少。
- 缺点：生命周期模块内部仍需严格保持状态、资源和诊断职责分区。
- 成本：低到中；主机测试和一次 rc.1 Loader 回归。
- 风险：若错误地拆成多个 Cordis effect，会失去顺序保证；通过单一组合 disposer 约束。
- 验收方式：主机状态/故障注入测试 + package dry-run + Desktop rc.1 reload/disable 日志证据 + M0 回归。
- 回滚方式：精确移除私有模块、M1 测试/脚本，并恢复 `package.json` 的 `files`；保留 M0 文件和证据。

### 方案 B：生命周期阶段管线 + 资源栈模块化

- 适用场景：已有多个独立阶段、资源类型和跨阶段扩展需求时使用。
- 做什么：拆分 `phase-runner`、`resource-stack`、错误模型等多个内部模块，再由生命周期门面编排。
- 主要改动：新增 `src/lifecycle/` 多个模块、更多测试和内部契约。
- 优点：阶段复用和单元隔离更强，未来扩展空间较大。
- 缺点：M1 当前没有多阶段资源需求，会增加状态同步、打包和回滚面。
- 成本：中到高；需要更多内部接口和组合测试。
- 风险：过度抽象、模块间清理顺序漂移、私有实现误变成公共接口。
- 验收方式：除方案 A 验收外，还需逐阶段契约和跨模块顺序测试。
- 回滚方式：需同时移除整个 `src/lifecycle/` 子树及其引用，回滚面更大。

### 方案对比

| 维度 | 方案 A | 方案 B | 结论依据 |
|---|---|---|---|
| 易理解程度 | 高 | 中 | M1 只有一个私有对象和一条 Host 入口 |
| 改动范围 | 小 | 大 | A 仅新增一个内部模块；B 为多模块拆分 |
| 实现复杂度 | 低 | 中高 | 当前无阶段复用需求 |
| 运行时资源 | 一对象、一组合 disposer | 多内部阶段对象 | M1 G-M1-01/G-M1-04 |
| 架构风险 | 低 | 中 | B 有过度抽象和顺序漂移风险 |
| 可验证性 | 直接 | 需跨模块组合测试 | V-M1-02..V-M1-10 |
| 回滚难度 | 低 | 中高 | 变更文件数量差异 |
| 后续扩展性 | 足够覆盖 M1 | 更强但未被需求使用 | M2+ 必须重新过 Spec 门禁 |

### 用户选择

```text
selected_option: A
decision_owner: user
decision_rationale: 采用最小、单一私有生命周期对象边界，保持 Cordis Fiber 为事实源，并避免提前引入公共注册和多模块抽象。
rejected_option: B
new_constraints: 单一 WorkbenchLifecycle 模块；单一组合 disposer；不新增公共 export、Service、Tool 或 Registry。
```

## 5. 选定方案概览

- 选定方案：`A：薄 Adapter + 单一私有生命周期模块`。
- 选定原因：它直接兑现用户确认的“一 Fiber 激活周期一个私有对象”，并将资源逆序清理集中在同一对象内。
- 与 `spec.md` 的一致性：保留 M1 的状态、所有权、失败、幂等、1000 ms 清理预算、rc.1 和 M0 回归约束，不新增产品能力。
- 施工边界：Host Adapter、私有生命周期模块、包文件清单、主机测试、M1 验证脚本和 rc.1 运行验收。
- 非目标：`src/client.js`、`cordis.patch.yml`、用户 profile、官方 DSH、`embedded_framework`、Service/Tool/Registry、外部 I/O。
- 主要风险：Host Adapter 与 Cordis disposer 绑定错误、异步竞态、清理超时诊断不完整、打包遗漏私有模块。已补充一次性受管 deadline、晚到 Promise 观察、STARTING/STOPPING 握手和真实 disposer 证据要求。

## 6. 分层、调用链与接口边界

```text
DSH Loader → Cordis Host Fiber → src/index.js 薄 Adapter → 私有 WorkbenchLifecycle
DSH Client Fiber → src/client.js Settings effect（M0 独立边界）
```

- 目标调用链：Host Fiber 激活调用 Adapter；Adapter 创建本次激活唯一对象并 `await lifecycle.start()`；成功后只返回单一组合 disposer `() => lifecycle.dispose()`；Fiber 卸载触发同一对象清理。启动失败必须在 Adapter 返回前由 Lifecycle 完成回滚并重抛。
- 各层职责：本包不引入嵌入式 App/Service/Platform/Impl/Vendor 分层；Host Adapter 只做宿主绑定，`WorkbenchLifecycle` 只做插件内部资源阶段，Cordis Fiber 负责装载/激活/卸载事实；二者状态名称和时间不要求一一对应。
- 允许依赖：`src/index.js` 依赖私有生命周期模块和 Cordis 公开上下文；测试可注入 Fake 资源与时钟。
- 禁止依赖：Cordis internal 状态作为契约、模块级 singleton、跨 Fiber 共享、`ctx.provide()`、Registry、Service、Tool、公共 export、外部 I/O。
- Wrapper/Port/Driver/Handle/Handler 边界：不适用；不得借 M1 引入嵌入式 Driver 或硬件 Handler。
- 接口输入、输出和所有权：`start()`/`dispose()` 返回并缓存同一可等待 Promise；对象拥有登记的资源 disposer；`snapshot()` 返回深复制或深冻结的 JSON-safe 快照；调用者不得接管内部资源。
- 阻塞、线程安全和可重入性：Node 异步单线程语义；接口不可在 ISR/RTOS 上下文使用；重复 `start()`/`dispose()` 以 Promise 身份严格共享 in-flight 结果；`STARTING × dispose()` 不互等，终态拒绝重新启动。

## 7. 文件施工顺序

| ID | 阶段 | 动作 | 文件或目录 | 所属层 | 施工内容与理由 | 责任 Skill | 前置条件 | 生成/覆盖边界 | 状态 |
|---|---:|---|---|---|---|---|---|---|---|
| P-01 | 1 | 不修改 | 工作区与 M0 Workflow | 基线 | 记录 git、包清单、M0 9/9 证据和当前运行基线 | `workflow-document-context` | M1 Spec 已确认 | 不覆盖 M0 文档/证据 | ready |
| P-02 | 2 | 新增 | `test/lifecycle.test.js` | Verification | 先写状态、失败、并发、超时和资源所有权的可执行契约 | `mcu-workbench:tdd` | P-01 | 只新增 M1 测试，不改 M0 断言语义 | ready |
| P-03 | 3 | 新增 | `src/workbench-lifecycle.js` | Plugin internal | 实现状态机、资源登记、逆序回滚、错误聚合、快照和 1000 ms 清理预算 | `mcu-workbench:workflow-ai-collab` | P-02 红灯 | 不导出公共能力，不注册对象 | ready |
| P-04 | 4 | 修改 | `src/index.js` | Host Adapter | 每次 `apply(ctx)` 创建一个私有对象；将 start/失败诊断接入 Host；将统一 disposer 交给 Cordis | `mcu-workbench:workflow-ai-collab` | P-03 | 保留 M0 `name`/加载标记语义，不改 Client | ready |
| P-05 | 5 | 修改 | `package.json` | Package | 将 `src/workbench-lifecycle.js` 纳入 `files`，保持 `exports` 不新增公共生命周期入口 | `mcu-workbench:tools-build` | P-03 | 不增加 Service/Tool/依赖，不改包身份 | ready |
| P-06 | 6 | 新增/修改 | `scripts/verify-m1.ps1`、现有 M0 tests、`scripts/verify-m0.ps1` | Verification tooling | 增加静态契约、零 Tool、单 row、包边界和 M0 语义回归；允许 files 从四项变五项但 exports 保持不变 | `mcu-workbench:tools-quality` | P-04/P-05 | 不改写 M0 历史证据；只修正当前断言以表达语义不变量 | ready |
| P-07 | 7 | 不修改 | `src/client.js`、`cordis.patch.yml`、用户 profile | M0 boundary | 运行回归；仅在证据证明必须调整时返回 Review Gate | `mcu-workbench:workflow-review-gate` | P-06 | 默认锁定 | locked |
| P-08 | 8 | 验证 | 隔离 Desktop rc.1 profile/runtime | Runtime verification | 同一 Loader 生命周期中采集旧 instance STOPPING→STOPPED/FAILED，再采集新 instance STARTING/RUNNING；不能以进程重启或 404 单独代替 disposer 证据 | `mcu-workbench:tools-verification` | P-06 | 不写当前用户 profile/官方安装 | ready |

## 8. 阶段计划与交接

| 阶段 | 目标 | 输入 | 输出 | 完成条件 | 交接对象 |
|---|---|---|---|---|---|
| 1 | 固化基线 | M1 Spec、M0 state、当前 git | 基线记录 | 工作区与 M0 证据可复现 | `workflow-task-breakdown` |
| 2 | 建立可执行契约 | M1 验收清单 | M1 主机测试红灯 | 测试覆盖 V-M1-02..10 | `workflow-task-execution` |
| 3 | 实现私有生命周期 | 测试与 Q-M1-01..04 | 生命周期模块 | 主机测试转绿，状态/资源/错误符合 Spec | `workflow-final-review` |
| 4 | 绑定 Host 与打包 | 生命周期模块、M0 Host | Adapter、完整 npm 包 | 每 Fiber 一对象且私有模块随包交付 | `tools-verification` |
| 5 | 运行与回归验证 | 构建包、隔离 rc.1 | 日志、快照、回归报告 | V-M1-01、V-M1-11..13 通过 | `workflow-final-review` |

## 8A. 下游执行 Agent 与 Skill 基线

| 阶段/ID | 主 Agent | 协作 Agent | 主实现 Skill | 辅助 Skill | 分配理由与证据 | 状态 |
|---|---|---|---|---|---|---|
| P-02/P-03 | `firmware-engineer` | `system-architect` | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:tdd`、`mcu-workbench:codebase-design` | 状态机、资源所有权和错误路径是 M1 核心；单对象边界已由用户确认 | ready |
| P-04/P-05 | `firmware-engineer` | `toolchain-engineer` | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:tools-build` | Host Adapter 与 package `files` 必须一起验证，避免私有模块漏包 | ready |
| P-06/P-08 | `verification-engineer` | `toolchain-engineer` | `mcu-workbench:tools-verification` | `mcu-workbench:tools-quality` | 需分开记录主机、构建和真实 rc.1 Loader 证据 | ready |

## 9. 资源、并发与生命周期约束

- 任务、优先级、栈和周期：不涉及 RTOS 任务、优先级、任务栈或周期任务；生命周期运行在 Cordis Host Fiber 的 Node 上下文。
- 队列、通知、信号量和互斥量：不创建；并发语义由共享 Promise 和 JS 事件循环保证。
- ISR 允许/禁止调用：不适用；不得把本对象用于 ISR 或硬件回调。
- DMA 缓冲区、Cache、对齐和所有权：不适用；M1 不创建外部 I/O/DMA 资源。
- 静态分配、内存池或堆：只允许有界 JS 状态、资源记录和测试 Fake；不得引入无界缓存、worker 或持久化。
- 初始化、运行、错误恢复和释放顺序：`CREATED → STARTING → RUNNING → STOPPING → STOPPED`；启动失败或清理失败进入 `FAILED`，资源按登记逆序尝试清理。
- 超时、重试、降级和取消：总清理预算 1000 ms；允许一次性受管 deadline primitive，正常完成时取消；超时只结束主等待链，底层 disposer 继续被观察，记录稳定错误码和残留数量，禁止强杀、自动重试或终态复活。

## 10. 代码生成约束

| ID | 约束类别 | 必须遵守 | 禁止事项 | 证据 | 状态 |
|---|---|---|---|---|---|
| G-M1-01 | 对象边界 | 每次 Fiber 激活周期最多一个私有对象 | singleton、跨 Fiber 共享、公共 export | Q-M1-01/G-M1-01 | ready |
| G-M1-02 | 框架边界 | Cordis Fiber 是激活/卸载事实源 | 复制或暴露 Fiber internal 状态 | F-M1-04/G-M1-02 | ready |
| G-M1-03 | 状态 | 只允许 Spec 定义的迁移，终态不可复活 | 静默跳转、失败原地重启 | Q-M1-02/03 | ready |
| G-M1-04 | 所有权 | 获取资源立即登记 disposer，统一逆序释放 | 多 effect 隐式顺序、重复释放 | F-M1-05/Q-M1-02 | ready |
| G-M1-05 | 错误 | 保留启动根因并聚合 cleanup 错误 | 吞错或覆盖根因 | Q-M1-02 | ready |
| G-M1-06 | 并发 | start/dispose 幂等并共享 in-flight Promise | 重复获取、释放、终态复活 | Q-M1-03 | ready |
| G-M1-07 | 超时 | 1000 ms 内结束清理决策并记录残留；一次性 deadline 可取消 | 无限等待、周期/遗留 timer、强杀、自动 retry | Q-M1-04 | ready |
| G-M1-08 | API | 仅包内 `start()`/`dispose()`/只读 `snapshot()` | Service、Tool、Registry、公共能力接口 | Q-M1-01/G-M1-08 | ready |
| G-M1-09 | 资源 | 仅有界状态和测试 Fake；deadline 由对象拥有 | 文件、进程、网络、串口、硬件、周期 timer、遗留后台任务 | M1 非目标/G-M1-09 | ready |
| G-M1-10 | 兼容 | 固定 Desktop DSH rc.1 + Cordis 4.0.1 | 用 rc.1 证据宣称 rc.2 | F-M1-06/G-M1-10 | ready |

## 11. 验收与验证计划

| ID | 证据等级 | 验收项 | 命令/条件 | 预期结果 | 责任 Skill | 产物 | 状态 |
|---|---|---|---|---|---|---|---|
| V-M1-01 | 静态/主机 | M0 边界回归 | `npm test`; `npm run verify:m0`; `npm run verify:m1` | 单 row、Settings、零 Tool、包边界不变 | `tools-quality` | test log、verify log | not-run |
| V-M1-02 | 主机 | 正常状态转换 | lifecycle Fake start/dispose | 合法迁移且每个操作只记录一次 | `tdd` | lifecycle test log | not-run |
| V-M1-03 | 主机 | 每 Fiber 一个实例 | 两 Fiber + reload fixture | 实例隔离，reload 新对象，旧对象不可用 | `tools-verification` | instance evidence | not-run |
| V-M1-04 | 主机 | 逆序清理 | Fake A/B/C | C/B/A 各一次，计数归零 | `tdd` | cleanup trace | not-run |
| V-M1-05 | 主机 | 启动失败回滚 | B 创建失败 | A 回滚，C 不创建，保留根因，FAILED | `tdd` | failure trace | not-run |
| V-M1-06 | 主机 | 清理错误聚合 | disposer throw/reject；晚到 reject | 所有 disposer 均尝试，cleanup_errors 可定位；晚到结果不改写终态且无 unhandled rejection | `tdd` | error snapshot | not-run |
| V-M1-07 | 主机 | 幂等并发 | `Promise.all([start(), start()])` 等；严格比较 Promise 身份 | 返回严格相同 Promise，底层创建/释放各一次，后续 dispose 不重复调用 | `tdd` | concurrency trace | not-run |
| V-M1-08 | 主机 | start/dispose 竞态 | STARTING 中 dispose | 不进入幽灵 RUNNING，晚到资源回滚 | `tdd` | race trace | not-run |
| V-M1-09 | 主机 | 终态保护 | STOPPED/FAILED 后 start/register | 稳定 terminal/invalid 错误，无新资源 | `tdd` | terminal trace | not-run |
| V-M1-10 | 主机 | 清理超时 | disposer 永不 resolve、晚到 resolve、晚到 reject | 1000 ms 内记录 timeout，FAILED，残留可定位；晚到结果不复活、不重试 | `tools-verification` | timeout log | not-run |
| V-M1-10a | 静态/主机 | 私有模块打包契约 | `npm pack --dry-run --json` | tarball 含 `src/workbench-lifecycle.js`；`exports` 仍为四项且无生命周期子路径 | `tools-build` | pack manifest | not-run |
| V-M1-11 | 主机/真实 Cordis | Adapter | `ctx.plugin()`、`fiber.await()`、`fiber.dispose()` | 对象由 Fiber 接管，错误可观察 | `tools-verification` | Cordis runtime log | not-run |
| V-M1-12 | Desktop rc.1 runtime | Loader reload | 同一受控 Loader 生命周期中触发 disable/re-enable 或明确 loader update | 先观察旧 `instance_id` STOPPING 与 STOPPED/FAILED，再允许新实例 STARTING/RUNNING；日志可成对关联 | `tools-verification` | runtime summary | deferred-to-following-milestone |
| V-M1-13 | Desktop rc.1 runtime | M0 UI/工具回归 | Settings、工具快照、精确 remove | UI 保持；tool diff 为空；其他 bundle/hash 不变 | `tools-verification` | dump-config、hash、tool diff | not-run |
| V-M1-14 | 目标板/实物 | MCU/硬件验证 | 不适用 | 记录 `not_applicable`，不外推硬件结论 | `tools-verification` | applicability record | not_applicable |

所有结构化生命周期记录至少包含：`instance_id`、`operation`、`from`、`to`、`result`、`error_code`、`duration_ms`、`cleanup_complete`、`remaining_resource_count`。`snapshot()` 必须是深复制或深冻结的 JSON-safe 数据，不包含 `ctx`、Fiber、Promise、disposer、原始 `Error` 或可变资源数组；`instance_id` 不得读取 `ctx.fiber.uid`。

## 12. 方案审查记录

| 审查项 | 责任 Agent | 结论 | 证据 | 修订或后续动作 |
|---|---|---|---|---|
| 分层和接口 | `system-architect` | `可采用` | M1 Spec Q-M1-01..04；Cordis Fiber/effect/disposer 语义；单一 Adapter 与私有模块无公共出口 | 按 A 实施，保持 Fiber 为事实源 |
| 文件和数据流 | `firmware-engineer` | `可采用` | `src/index.js` 无状态基线；`src/client.js` M0 effect 独立；资源统一由生命周期对象持有 | `src/client.js`、patch 锁定 |
| 验收和回归 | `verification-engineer` | `可采用` | V-M1-01..14 分离主机、rc.1、目标板不适用证据 | 先主机测试，再 rc.1 Loader |
| 硬件边界 | `hardware-integration` | `不适用` | M1 Spec 明确不引入 MCU/硬件/RTOS/DMA | 保留 V-M1-14 `not_applicable` |
| 工具链和产物 | `toolchain-engineer` | `可采用` | `package.json` `files` 当前不含私有模块；M1 计划补齐但不增 export | 对 package dry-run 增加断言 |

### 审查结论

- 可采用项：方案 A 的分层接口、文件数据流和总体验收方向。
- 已完成修订：补充一次性 deadline、晚到 Promise 观察、STARTING/STOPPING 握手、start 失败自回滚、私有模块打包和 M0 语义回归边界。
- 未关闭阻塞：无；V-M1-12 已记录为后续里程碑延期项。
- 是否改变 `spec.md`：是，已回到 Review Gate；本计划同步修订。
- 最终结论：M1 按延期决策继续 Final Review。

## 13. 回滚与失败处理

- 代码或配置回滚方式：以 `7ebd7ff280fc124a22e77f371a9e10cc69d7260f` 为锚点恢复 M1 修改的 `src/index.js`、`package.json`、M0 verifier/tests，删除 M1 新文件和 request-scoped 计划；不回退 M0 提交。
- 中途失败后的保留状态：保留失败测试、结构化快照和运行日志；失败 Lifecycle 维持 `FAILED`，不原地重试。
- 验收失败后的定位顺序：先 `npm test`/静态契约，再 package dry-run，再 Cordis Host 单元，再 Desktop rc.1 Loader；区分主机和运行时证据。
- 不可恢复情况：若 Cordis 公开 API、rc.1 包闭包或用户 profile 变更导致入口不可复现，停止扩大范围并回传 `workflow-review-gate`；不宣称 rc.2 或硬件兼容。

## 14. 下游交接

- 正式需求/约束输入：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M1-20260827\spec.md`
- 正式实施计划：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M1-20260827\plan.md`
- 阶段级 Agent/Skill 基线：本文件第 8A 节。
- 每项任务的主 Agent、协作 Agent、主实现 Skill 和辅助 Skill：由 `workflow-task-breakdown` 回填到同目录 `task.md`。
- 执行分配规则：计划获 H-03 批准后，逐项任务执行；同一时刻只修改一个任务范围，先复核分配，再交给一个主实现 Skill。
- 目标文件范围：`src/index.js`、`src/workbench-lifecycle.js`、`package.json`、M1 测试、`scripts/verify-m1.ps1`；M0 client/patch 和外部 profile 锁定。
- 执行前必须确认：基线提交、Cordis rc.1 公开 API、资源 disposer 顺序、1000 ms 测试时钟、package `files`。
- 禁止扩大：Registry/Service/Tool/公共 API、外部 I/O、M2-M5、rc.2、硬件和当前用户 profile 写入。
- 实现完成后交接：`workflow-final-review`。
- 未验证项：M1 主机故障注入、真实 Cordis Adapter、清理超时运行证据均尚未执行；Desktop rc.1 reload（V-M1-12）已延期至后续里程碑。
- 回传规则：任何改变对象边界、状态、权限、资源、并发或验收的事实，退回 `workflow-review-gate` 并修订 Spec。

## 15. 当前状态与下一步

- 当前状态：`approved-with-v-m1-12-deferred / final-review-ready`。
- V-M1-12 已按用户决策延期至后续里程碑（M2+，具体环次待后续 Spec 指定），不再阻塞本轮验收。
- 下一步：继续执行 M1 Final Review；通过后提交并推送更新。
