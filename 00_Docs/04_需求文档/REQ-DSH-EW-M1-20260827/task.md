# M1 实施任务清单：私有 WorkbenchLifecycle

> 本文件由 `workflow-task-breakdown` 根据已批准的 M1 Spec 与方案 A Plan 生成。
> M0 根目录 `00_Docs/04_需求文档/task.md` 是历史基线，本文件采用 M1 request-scoped 目录以避免覆盖 M0。

## 1. 元数据

| 字段 | 内容 |
|---|---|
| request_id | `REQ-DSH-EW-M1-20260827` |
| 任务清单版本 | `v0.1` |
| 状态 | `最终审查就绪（B-04 延期）` |
| 项目路径与提交 | `D:\zhuomian\dsh-embedded-workbench @ main / 7ebd7ff280fc124a22e77f371a9e10cc69d7260f` |
| 输入 spec.md | `D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M1-20260827\spec.md` |
| 输入 plan.md | `D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M1-20260827\plan.md` |
| Spec 力度 | `full` |
| 风险叠加门禁 | `versioned` |
| 生成时间 | `2026-08-27T00:00:00+08:00` |
| 用户门禁 | `H-02 Spec approved; H-03 Plan approved` |
| 阶段级 Agent/Skill 基线 | Plan §8A |
| 下游执行 Skill | `workflow-task-execution` |

可信等级：`confirmed`、`user-confirmed`、`inferred`、`unverified`。本清单中的实现任务均继承 Spec/Plan；任何改变对象边界、状态、资源、并发、权限或验收标准的新事实必须回传上游。

## 2. 总体任务图

```text
T-001 基线与回归契约
  ↓
T-002 生命周期测试契约（红灯）
  ↓
T-003 WorkbenchLifecycle 实现
  ↓
T-004 Host Adapter 绑定
  ↓
T-005 包清单与 M0 语义回归
  ↓
T-006 M1 静态验证脚本
  ├──────────────→ T-007 真实 Cordis Host 验证
  └──────────────→ T-008 Desktop rc.1 Loader 验证
                         ↓
                    T-009 最终集成 Verify
```

- 总体目标：实现每个 Cordis Host Fiber 激活周期一个私有 `WorkbenchLifecycle`，并完成主机、打包、Cordis 和 Desktop rc.1 证据闭环。
- 非目标：Registry、Service、Tool、公共能力接口、外部 I/O、硬件、RTOS、M2-M5、rc.2 和用户 profile 写入。
- 关键串行链：`T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-009`。
- 可并行任务组：`T-007` 与 `T-008` 可在 `T-006` 完成后并行；二者都不得修改产品源码。
- 不可并行原因：T-002/T-003/T-004/T-005 依次拥有测试、生命周期、Host 和 manifest 的修改边界，避免同一文件并发修改。

## 3. 任务索引

| 顺序 | task_id | 任务名称 | 前置任务 | 并行组 | 主 Agent | 主实现 Skill | 辅助 Skill | 验证等级 | 状态 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | T-001 | 固化 M0 基线并建立语义回归契约 | none | none | `verification-engineer` | `mcu-workbench:tools-verification` | `mcu-workbench:workflow-document-context` | static/host | pass |
| 2 | T-002 | 建立 Lifecycle 状态与故障注入测试契约 | T-001 | none | `firmware-engineer` | `mcu-workbench:tdd` | `mcu-workbench:codebase-design` | host | pass |
| 3 | T-003 | 实现私有 WorkbenchLifecycle | T-002 | none | `firmware-engineer` | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:tdd` | host | pass |
| 4 | T-004 | 将 Lifecycle 绑定到 Host Fiber | T-003 | none | `firmware-engineer` | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:codebase-design` | host | pass |
| 5 | T-005 | 闭合私有模块打包与 M0 语义回归 | T-004 | none | `firmware-engineer` | `mcu-workbench:tools-build` | `mcu-workbench:tools-quality` | build/host | pass |
| 6 | T-006 | 增加 M1 静态验证出口 | T-005 | none | `verification-engineer` | `mcu-workbench:tools-quality` | `mcu-workbench:tools-verification` | static/host/build | pass |
| 7 | T-007 | 验证真实 Cordis Host disposer | T-006 | G-01 | `verification-engineer` | `mcu-workbench:tools-verification` | `mcu-workbench:workflow-final-review` | host | pass |
| 8 | T-008 | 验证 Desktop rc.1 Loader 生命周期 | T-006 | G-01 | `verification-engineer` | `mcu-workbench:tools-verification` | `mcu-workbench:tools-quality` | target | deferred |
| 9 | T-009 | 执行最终集成 Verify 与交接 | T-007/T-008 | none | `verification-engineer` | `mcu-workbench:workflow-final-review` | `mcu-workbench:tools-quality` | static/host/build/target | ready-for-final-review |

## 4. 任务详情

### T-001：固化 M0 基线并建立语义回归契约

| 字段 | 内容 |
|---|---|
| order | 1 |
| parallel_group | none |
| source_plan_ids | `P-01`, `P-06` |
| source_spec_ids | `F-M1-01`, `F-M1-02`, `F-M1-03`, `F-M1-06`, `G-M1-10`, `V-M1-01` |
| owner_agent | `verification-engineer` |
| support_agents | `none` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:workflow-document-context` |
| allocation_evidence | M0 Workflow 已有 9/9 通过证据；当前 git、manifest、测试和 rc.1 运行记录可读。先固化基线，避免把后续 M1 结果倒写进 M0。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

形成可复现的 M0 基线记录，并明确 M1 允许的包 `files` 增量与不变的 exports、Settings、单 row、零 Tool 语义。

#### 范围

- 包含：读取 git 状态、M0 state/events、`package.json`、现有 tests、`scripts/verify-m0.ps1`；建立回归断言调整清单。
- 不包含：实现 Lifecycle、修改产品源码、修改 M0 历史文档或用户 profile。
- 文件范围：仅新增任务执行记录；若需修正断言，交由 T-005。
- 所属层：Verification / baseline。

#### 前置条件与依赖

- 前置任务：无。
- 外部前提：基线提交 `7ebd7ff280fc124a22e77f371a9e10cc69d7260f` 可访问。
- 依赖证据：`.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/state.json`、`src/index.js`、`package.json`、`test/*.test.js`。

#### 执行步骤

1. 执行 `git status --short --branch` 并记录当前未跟踪 M1 文档。
2. 运行 M0 主机测试和 verifier，记录包、exports、patch、零 Tool 结果。
3. 对照 M1 Spec/Plan，列出四文件历史快照必须改为语义不变量的具体断言。

#### 输出物

- 文件：T-001 执行记录和基线日志。
- 符号/接口：无。
- 中间产物：M0 回归基线摘要。

#### 约束边界

- 接口和依赖：不新增接口；不访问 Cordis internal。
- 资源与生命周期：无运行资源变更。
- 并发、ISR、DMA：不适用。
- 内存和生成边界：只读检查，不生成业务代码。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host` |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; `npm test`; `npm run verify:m0` |
| 预期结果 | 当前基线 12 个主机测试通过，M0 verifier 返回 `status=pass`。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-001/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 失败现象：M0 测试或 verifier 在未改代码时失败。
- 定位顺序：git 状态 → Node/npm 版本 → M0 日志 → 测试 fixture；不得直接修改 M1 代码。
- 重试/降级：仅允许在相同基线重跑；环境差异回传 Review Gate。
- 回滚：删除 T-001 临时日志，不触碰 M0 证据。
- 回传条件：发现 M0 事实与 Spec/Plan 不一致时停止后续任务。

### T-002：建立 Lifecycle 状态与故障注入测试契约

| 字段 | 内容 |
|---|---|
| order | 2 |
| parallel_group | none |
| source_plan_ids | `P-02` |
| source_spec_ids | `Q-M1-01..04`, `G-M1-01..09`, `V-M1-02..10` |
| owner_agent | `firmware-engineer` |
| support_agents | `system-architect` |
| owner_skill | `mcu-workbench:tdd` |
| supporting_skills | `mcu-workbench:codebase-design` |
| allocation_evidence | Plan 指定 Lifecycle 测试先行；状态、所有权、竞态和错误聚合需要独立主机断言。 |
| confidence | `user-confirmed` |
| status | `pass` |

#### 目标

新增 `test/lifecycle.test.js`，以 Fake 资源、Deferred Promise 和 FakeClock 覆盖 M1 状态及失败契约，初始允许因实现尚不存在而红灯。

#### 范围

- 包含：正常迁移、实例隔离、逆序清理、启动回滚、错误聚合、Promise 身份、STARTING/STOPPING 握手、终态保护、timeout、晚到 resolve/reject、JSON-safe snapshot。
- 不包含：Host Adapter、Desktop Loader、外部 I/O、真实硬件。
- 文件范围：`test/lifecycle.test.js`。
- 所属层：Verification / plugin internal。

#### 前置条件与依赖

- 前置任务：T-001。
- 外部前提：测试运行入口 `npm test` 已确认。
- 依赖证据：M1 Spec `V-M1-02..10`、Cordis disposer 语义记录。

#### 执行步骤

1. 定义可控 Fake resource、Deferred disposer、FakeClock 和日志收集器。
2. 编写状态迁移、资源逆序和 startup failure rollback 断言。
3. 编写严格 `start() === start()`、`dispose() === dispose()` 断言及竞态握手。
4. 编写 cleanup timeout、晚到结果、cleanup error 聚合和终态不可复活断言。
5. 运行测试并记录红灯原因，不为通过测试而放宽契约。

#### 输出物

- 文件：`test/lifecycle.test.js`。
- 符号/接口：测试使用的私有 lifecycle factory seam，不定义公共 export。
- 中间产物：T-002 红灯日志和覆盖矩阵。

#### 约束边界

- 接口和依赖：只测试包内 `start()`、`dispose()`、`snapshot()`；禁止 Registry/Service/Tool。
- 资源与生命周期：资源创建后立即登记 disposer；单一组合栈逆序清理。
- 并发、ISR、DMA：JS Promise 并发；不涉及 ISR/DMA。
- 内存和生成边界：Fake 资源有界；deadline 使用可控 FakeClock，禁止遗留周期 timer。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; `node --test test/lifecycle.test.js` |
| 预期结果 | 测试文件可执行；未实现阶段只允许预期红灯，失败断言必须对应 M1 契约。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-002/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 失败现象：测试本身无法运行或断言依赖未确认 API。
- 定位顺序：测试语法 → fixture 可控性 → M1 Spec 映射 → 实现缺口。
- 重试/降级：不得删除失败路径；若需新增语义，回传 Spec/Plan。
- 回滚：仅移除 T-002 新增测试文件。
- 回传条件：需要改变状态、超时、公共 API 或资源边界时停止。

### T-003：实现私有 WorkbenchLifecycle

| 字段 | 内容 |
|---|---|
| order | 3 |
| parallel_group | none |
| source_plan_ids | `P-03` |
| source_spec_ids | `Q-M1-01..04`, `G-M1-01..09`, `V-M1-02..10` |
| owner_agent | `firmware-engineer` |
| support_agents | `system-architect` |
| owner_skill | `mcu-workbench:workflow-ai-collab` |
| supporting_skills | `mcu-workbench:tdd` |
| allocation_evidence | 方案 A 将状态、资源栈、错误聚合和快照集中在一个私有模块；T-002 已提供可执行契约。 |
| confidence | `user-confirmed` |
| status | `pass` |

#### 目标

实现 `src/workbench-lifecycle.js`，使 T-002 主机测试转绿，同时满足对象私有、终态不可复活、异步幂等、逆序清理和 1000 ms deadline 语义。

#### 范围

- 包含：私有 factory/class、状态迁移、资源登记、统一 cleanup、startup rollback、错误聚合、deadline、晚到 Promise 观察、深冻结/复制 snapshot。
- 不包含：Cordis `ctx` 绑定、公共 export、Service/Tool/Registry、外部资源。
- 文件范围：`src/workbench-lifecycle.js`、必要时 T-002 测试适配。
- 所属层：Plugin internal。

#### 前置条件与依赖

- 前置任务：T-002。
- 外部前提：Node ESM 和当前 package `type=module`。
- 依赖证据：M1 Spec 补充的 STARTING×dispose 握手和 deadline 约束。

#### 执行步骤

1. 定义内部状态、资源记录和结构化诊断模型。
2. 实现不包装新 Promise 的 start/dispose 缓存语义，并在每次 await 后检查 `stopRequested`。
3. 实现资源立即登记、逆序清理和启动失败自回滚后重抛。
4. 实现一次性 deadline primitive；timeout 后保留 residual、挂接 catch/finally，禁止重复 disposer。
5. 实现 JSON-safe snapshot，隐藏 ctx/Fiber/Promise/disposer/Error/可变数组。
6. 运行 T-002，确认正常、失败、竞态、超时和晚到路径全部通过。

#### 输出物

- 文件：`src/workbench-lifecycle.js`。
- 符号/接口：包内 `start()`、`dispose()`、`snapshot()`；私有资源登记 seam。
- 中间产物：T-003 主机测试日志、生命周期事件快照。

#### 约束边界

- 接口和依赖：不读取 `ctx.fiber.uid`；不依赖 Cordis internal。
- 资源与生命周期：同一对象拥有全部 disposer；cleanup 总预算 1000 ms；超时不宣称资源已释放。
- 并发、ISR、DMA：`start()` 不等待 `disposePromise`，`dispose()` 等待 start settle 后进入唯一 cleanup；不涉及 ISR/DMA。
- 内存和生成边界：有界 JS 状态和 Fake；禁止 worker、持久化和周期 timer。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; `node --test test/lifecycle.test.js` |
| 预期结果 | T-002 所有生命周期断言通过；Promise 身份严格相等；timeout/晚到路径无 unhandled rejection。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-003/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 失败现象：状态迁移错误、资源重复释放、超时未收敛或 snapshot 泄漏内部对象。
- 定位顺序：状态表 → Promise 握手 → disposer trace → deadline/finally → snapshot 序列化。
- 重试/降级：只修复已确认契约；不可通过增加自动 retry 放宽失败语义。
- 回滚：删除 `src/workbench-lifecycle.js`，保留测试红灯日志。
- 回传条件：发现 1000 ms 无法在当前 Node seam 实现，回传 Review Gate。

### T-004：将 Lifecycle 绑定到 Host Fiber

| 字段 | 内容 |
|---|---|
| order | 4 |
| parallel_group | none |
| source_plan_ids | `P-04` |
| source_spec_ids | `F-M1-02`, `F-M1-04`, `G-M1-02`, `G-M1-04`, `V-M1-11` |
| owner_agent | `firmware-engineer` |
| support_agents | `system-architect` |
| owner_skill | `mcu-workbench:workflow-ai-collab` |
| supporting_skills | `mcu-workbench:codebase-design` |
| allocation_evidence | Cordis 在 `apply()` 成功后接管返回 disposer；启动失败时必须由 Lifecycle 自身回滚。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

修改 `src/index.js`，使每次 Host Fiber `apply(ctx)` 创建一个私有对象，成功启动后返回单一组合 disposer `() => lifecycle.dispose()`。

#### 范围

- 包含：Host Adapter 创建、start await、失败传播、单一 disposer 返回、M0 load marker 保留。
- 不包含：Client Settings、patch、公共导出、Service/Tool/Registry。
- 文件范围：`src/index.js`。
- 所属层：Host Adapter。

#### 前置条件与依赖

- 前置任务：T-003。
- 外部前提：Cordis 4.0.1 的 apply/disposer 公开行为已确认。
- 依赖证据：Cordis `lib/index.js` Fiber/effect/disposer 实现；M1 Spec Adapter 约束。

#### 执行步骤

1. 在 `apply(ctx)` 内创建本次激活的 lifecycle，不使用模块级 singleton。
2. `await lifecycle.start()`；若失败，确认回滚完成后重抛原始启动错误。
3. 成功后返回绑定好的 `() => lifecycle.dispose()`，避免丢失对象上下文。
4. 保留 M0 name 和加载日志，不把 lifecycle 暴露到 package exports 或 ctx service。
5. 运行 Host seam 测试，覆盖 Fiber reload 时新旧实例隔离。

#### 输出物

- 文件：修改后的 `src/index.js`。
- 符号/接口：Host `apply(ctx)`；不新增公共 package export。
- 中间产物：Adapter 主机日志和 instance_id 关联记录。

#### 约束边界

- 接口和依赖：只使用 Cordis 公开 Host seam；不得读取 Fiber internal state。
- 资源与生命周期：Cordis 只接管单一组合 disposer；Lifecycle 自身负责 start failure rollback。
- 并发、ISR、DMA：Node 异步；不适用于 ISR/DMA。
- 内存和生成边界：每次 apply 一个对象；不得缓存到模块级变量。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; `node --test test/lifecycle.test.js test/backend.test.js` |
| 预期结果 | Host apply 可创建/启动/返回 disposer；失败可观察且不遗留资源；M0 marker 保留。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-004/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 失败现象：Cordis 未接管 disposer、apply 返回后状态异常或旧实例残留。
- 定位顺序：apply 返回值 → lifecycle start 结果 → disposer this 绑定 → Fiber unload trace。
- 重试/降级：只在隔离 Host fixture 重试；不得修改 Client/patch 规避失败。
- 回滚：恢复 `src/index.js` 到基线内容；保留 T-004 日志。
- 回传条件：若必须新增公共宿主 API，停止并回传 Spec/Plan。

### T-005：闭合私有模块打包与 M0 语义回归

| 字段 | 内容 |
|---|---|
| order | 5 |
| parallel_group | none |
| source_plan_ids | `P-05`, `P-06` |
| source_spec_ids | `F-M1-08`, `G-M1-08`, `V-M1-01`, `V-M1-10a` |
| owner_agent | `firmware-engineer` |
| support_agents | `toolchain-engineer` |
| owner_skill | `mcu-workbench:tools-build` |
| supporting_skills | `mcu-workbench:tools-quality` |
| allocation_evidence | 当前 `files` 不含私有模块；既有 M0 四文件断言必须允许合法第五个产品文件，但 exports 仍保持四项。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

使 npm tarball 包含 `src/workbench-lifecycle.js` 而不公开新的 exports，并将 M0 回归断言改为语义不变量。

#### 范围

- 包含：`package.json` files、package contract tests、M0 verifier/test 中受影响的文件断言。
- 不包含：新增 Service/Tool、修改 package identity、修改 M0 历史文档。
- 文件范围：`package.json`、`test/package-contract.test.js`、`test/verify-m0.test.js`、`test/tool-snapshot.test.js`、`scripts/verify-m0.ps1`（仅必要断言）。
- 所属层：Package / Verification。

#### 前置条件与依赖

- 前置任务：T-004。
- 外部前提：npm pack dry-run 入口可用。
- 依赖证据：`package.json:7-19` 及审查发现的四文件精确断言。

#### 执行步骤

1. 在 `files` 增加 `src/workbench-lifecycle.js`，保持 `exports` 四项不变。
2. 更新精确文件断言：允许五个产品文件，仍拒绝测试 fixture 和未授权入口。
3. 保持单 row、Settings、零 Tool/Service、patch 和包身份语义不变。
4. 执行 package contract、M0 verifier 和 pack dry-run。

#### 输出物

- 文件：`package.json` 及必要 M0 断言文件。
- 符号/接口：无新增公共 export；私有模块仅作为包内运行依赖。
- 中间产物：npm pack manifest、M0 regression log。

#### 约束边界

- 接口和依赖：不得新增 exports 子路径、peer dependency、Tool 或 Service。
- 资源与生命周期：不改变 Lifecycle 语义。
- 并发、ISR、DMA：不适用。
- 内存和生成边界：仅 manifest/测试断言；不修改外部 profile。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `build/host` |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; `npm pack --dry-run --json`; `npm test`; `npm run verify:m0` |
| 预期结果 | tarball 含五个产品文件且无生命周期 export；M0 语义回归通过。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-005/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 失败现象：私有模块漏包、exports 泄漏或 M0 断言误报。
- 定位顺序：pack manifest → package.json files/exports → contract tests → verifier。
- 重试/降级：只修正断言与 manifest，不删除 M0 语义检查。
- 回滚：恢复 `package.json` 和受影响测试/verifier 到基线；不删除历史证据。
- 回传条件：若必须改变包身份或公开 API，回传 Plan。

### T-006：增加 M1 静态验证出口

| 字段 | 内容 |
|---|---|
| order | 6 |
| parallel_group | none |
| source_plan_ids | `P-06` |
| source_spec_ids | `G-M1-01..10`, `V-M1-01`, `V-M1-10a` |
| owner_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| owner_skill | `mcu-workbench:tools-quality` |
| supporting_skills | `mcu-workbench:tools-verification` |
| allocation_evidence | M1 需要独立 verifier 检查私有边界、状态契约、package files 和 M0 语义回归；Plan 明确不替换 M0 verifier。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

新增 `scripts/verify-m1.ps1`，形成只读、机器可判定的 M1 静态与主机验证出口。

#### 范围

- 包含：检查 lifecycle 模块私有性、禁止 Service/Tool/Registry、package files/exports、M0 row/Settings/patch 和测试入口。
- 不包含：Desktop UI 操作、真实硬件、进程强杀或 profile 写入。
- 文件范围：`scripts/verify-m1.ps1`。
- 所属层：Verification tooling。

#### 前置条件与依赖

- 前置任务：T-005。
- 外部前提：M1 产品源码和 package manifest 已闭合。
- 依赖证据：M1 `G-M1-01..10`、`V-M1-01`、`V-M1-10a`。

#### 执行步骤

1. 检查目标文件存在和 package files/exports 关系。
2. 扫描禁止 API/依赖和 M0 语义不变量。
3. 调用主机测试与 pack dry-run，输出结构化 JSON 结果。
4. 对失败项给出稳定 check id，不吞错。

#### 输出物

- 文件：`scripts/verify-m1.ps1`。
- 符号/接口：命令行验证出口，不是产品公共 API。
- 中间产物：M1 verifier JSON 与日志。

#### 约束边界

- 接口和依赖：只读仓库和隔离输入；禁止修改当前用户 profile。
- 资源与生命周期：不创建持久资源。
- 并发、ISR、DMA：不适用。
- 内存和生成边界：输出有界 JSON；不生成源码。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host/build` |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-m1.ps1` |
| 预期结果 | 返回 `status=pass`，并明确 package、private-boundary、M0-regression、lifecycle-test 检查结果。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-006/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 失败现象：静态扫描误报、漏报或 verifier 修改工作区。
- 定位顺序：JSON schema → 路径/编码 → 单项 check → 完整脚本。
- 重试/降级：只读重跑；不以跳过检查代替通过。
- 回滚：删除 `scripts/verify-m1.ps1` 及其临时产物。
- 回传条件：检查需要新增产品 API 或改变 Spec 时停止。

### T-007：验证真实 Cordis Host disposer

| 字段 | 内容 |
|---|---|
| order | 7 |
| parallel_group | G-01 |
| source_plan_ids | `P-08` |
| source_spec_ids | `F-M1-04`, `F-M1-05`, `V-M1-11` |
| owner_agent | `verification-engineer` |
| support_agents | `none` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:workflow-final-review` |
| allocation_evidence | Cordis Host 的 disposer 接管必须独立于 Desktop 进程重启证据；需要同一 Fiber 的 apply/unload 日志。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

在真实 Cordis 4.0.1 Host seam 中证明 apply 创建对象、失败可观察、Fiber unload 执行同一实例的 disposer。

#### 范围

- 包含：`ctx.plugin()`、`fiber.await()`、`fiber.dispose()`、instance_id 成对日志和失败路径。
- 不包含：修改产品源码、Desktop UI、rc.2、硬件。
- 文件范围：测试 fixture/运行记录目录；不修改产品文件。
- 所属层：Host runtime verification。

#### 前置条件与依赖

- 前置任务：T-006。
- 外部前提：Desktop rc.1 bundled Cordis 4.0.1 路径可用。
- 依赖证据：Cordis runtime source 及 T-004 Adapter。

#### 执行步骤

1. 在隔离 Host fixture 装载当前包并记录 Fiber/instance_id。
2. 触发 unload，确认旧实例 STOPPING 与 STOPPED/FAILED 由同一 disposer 产生。
3. 注入启动失败，确认 Cordis 尚未取得 disposer 时 Lifecycle 已自回滚并重抛。
4. 保存结构化日志，不以“进程重启后正常”替代 disposer 证据。

#### 输出物

- 文件：Host fixture 和运行记录。
- 符号/接口：无公共接口。
- 中间产物：Cordis runtime log、instance trace、failure snapshot。

#### 约束边界

- 接口和依赖：只使用真实 Cordis 公开 seam。
- 资源与生命周期：同一 Fiber 一对象，卸载只执行一次 cleanup。
- 并发、ISR、DMA：Node runtime；不适用 ISR/DMA。
- 内存和生成边界：隔离 fixture，不写当前用户 profile。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; 使用固定 Cordis 4.0.1 fixture 执行 apply/unload/failure 场景 |
| 预期结果 | 旧 instance 的 cleanup 真实执行且可关联；启动失败自回滚；无重复 disposer/unhandled rejection。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-007/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 失败现象：无法证明同一实例 disposer，或 runtime 版本漂移。
- 定位顺序：fixture package → Cordis version → apply return → unload trace。
- 重试/降级：允许在同一 rc.1 runtime 重试；不得改称 Desktop 重启证据为 Host disposer 证据。
- 回滚：删除隔离 fixture/运行产物，不触碰产品或用户 profile。
- 回传条件：真实 Host seam 不可复现时标记 blocked 并回传 Review Gate。

### T-008：验证 Desktop rc.1 Loader 生命周期

| 字段 | 内容 |
|---|---|
| order | 8 |
| parallel_group | G-01 |
| source_plan_ids | `P-08` |
| source_spec_ids | `F-M1-06`, `V-M1-12`, `V-M1-13` |
| owner_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:tools-quality` |
| allocation_evidence | M0 已有 Desktop rc.1 运行记录；M1 要求把 live disposer 证据与 Desktop package/UI/zero-tool 证据分开。 |
| confidence | `confirmed` |
| status | `deferred` |

#### 目标

在项目内隔离的 Desktop DSH rc.1 环境中验证加载、reload/disable-re-enable、M0 UI 和零 Tool 回归，不修改当前用户 profile。

#### 范围

- 包含：实际 pack 安装、Loader 激活、Settings/row/tool/hash/remove 证据；live reload/disable-re-enable 按用户决策延期。
- 不包含：用进程重启替代 disposer 证据、rc.2、硬件、公共发布。
- 文件范围：`.mcu-workbench/workflows/.../runs/T-008/` 隔离运行目录。
- 所属层：Desktop runtime verification。

#### 前置条件与依赖

- 前置任务：T-006；T-007 可并行但其结果不替代本任务。
- 外部前提：Desktop DSH rc.1 与 Cordis 4.0.1 可启动；隔离 `DSH_HOME` 可创建。
- 依赖证据：M0 T-006/T-009 runtime logs、pack manifest。

#### 执行步骤

1. 使用当前包 dry-pack 结果构造隔离 profile，记录 protected hashes。
2. 激活插件并记录 instance_id、start 状态和 Settings row。
3. 记录同一受控 Loader 生命周期的 live reload/disable-re-enable 入口缺失，并将 V-M1-12 标记为延期。
4. 采集已有的 tool diff、bundle/hash、精确 remove 和 client 404/Settings 消失证据。
5. 分别标记 `host-real-cordis`、`desktop-rc.1-runtime` 与 `deferred` 证据等级。

#### 输出物

- 文件：T-008 隔离 profile、runtime logs、dump-config、tool diff、hash/remove 报告。
- 符号/接口：无。
- 中间产物：旧新 instance 成对生命周期摘要。

#### 约束边界

- 接口和依赖：只使用 rc.1；不写当前用户 profile。
- 资源与生命周期：清理超时或 FAILED 必须保留 residual 诊断，不强杀 disposer。
- 并发、ISR、DMA：不适用。
- 内存和生成边界：隔离 runtime，验证后可精确移除。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `target`（Desktop runtime；非 MCU target） |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; 使用隔离 `DSH_HOME` 与 Desktop DSH rc.1 Loader 执行激活/reload/remove |
| 预期结果 | Settings 保持；tool diff added/removed 为空；其他 bundle/hash 不变；remove 后入口按预期消失；V-M1-12 记录为后续里程碑延期。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-008/` |
| 当前状态 | `deferred` |

#### 失败处理与回滚

- 失败现象：profile 污染、tool diff 非空或 UI 证据缺失；live reload seam 缺失属于已确认延期项。
- 定位顺序：隔离路径 → pack manifest → Loader log → instance trace → UI/tool/hash。
- 重试/降级：已保留 Settings/UI 与精确 remove 证据；live reload 不在 M1 内实现，不以其他证据替代。
- 回滚：执行隔离 profile 精确 remove，复核端口释放、Settings 消失和受保护 hash；保留失败日志。
- 回传条件：需要修改用户 profile、官方 DSH 或 rc.2 时立即停止。

### T-009：执行最终集成 Verify 与交接

| 字段 | 内容 |
|---|---|
| order | 9 |
| parallel_group | none |
| source_plan_ids | `P-01..P-08` |
| source_spec_ids | `V-M1-01..V-M1-14` |
| owner_agent | `verification-engineer` |
| support_agents | `system-architect`, `toolchain-engineer` |
| owner_skill | `mcu-workbench:workflow-final-review` |
| supporting_skills | `mcu-workbench:tools-quality`、`mcu-workbench:tools-verification` |
| allocation_evidence | Plan §11 要求统一对照 Spec 验收，区分 static/host/build/Desktop runtime/not_applicable；所有前置任务必须完成。 |
| confidence | `confirmed` |
| status | `ready-for-final-review` |

#### 目标

汇总 T-001..T-008 证据，逐项执行 M1 最终 Verify，确认变更集未越界，并交接给 `workflow-final-review`。

#### 范围

- 包含：全量 npm tests、M0/M1 verifier、pack manifest、Host Cordis、已完成的 Desktop rc.1 证据、git diff、延期项和回滚记录。
- 不包含：新功能实现、硬件验证、rc.2 兼容声明、未批准范围修订。
- 文件范围：最终验证报告和 workflow runs；不再修改产品源码。
- 所属层：Final verification/review。

#### 前置条件与依赖

- 前置任务：T-007；T-008 已按用户决策延期并完成记录。
- 外部前提：所有纳入 M1 的任务各自验证通过；延期项不得被当作通过证据。
- 依赖证据：M1 Spec、Plan、所有 task logs 和最终 git diff。

#### 执行步骤

1. 执行 `npm test`、`npm run verify:m0`、`npm run verify:m1`、pack dry-run。
2. 对照 V-M1-01..14，分别记录 static、host、build、Desktop runtime、deferred、not_applicable。
3. 检查 `src/client.js`、`cordis.patch.yml`、用户 profile 和外部仓库未被越界修改。
4. 检查结构化记录字段、instance 隔离、cleanup residual 和 late Promise 结果。
5. 生成最终报告并交给 `workflow-final-review`。

#### 输出物

- 文件：最终 Verify 报告、状态更新、完整运行产物索引。
- 符号/接口：无。
- 中间产物：M1 验收矩阵和最终 diff 摘要。

#### 约束边界

- 接口和依赖：不得在 Verify 阶段新增 API 或修代码掩盖失败。
- 资源与生命周期：验证后隔离资源全部精确清理；不删除历史证据。
- 并发、ISR、DMA：不适用；硬件 V-M1-14 固定 `not_applicable`。
- 内存和生成边界：只生成报告和结构化日志。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host/build/target` |
| 命令或条件 | cwd=`D:\zhuomian\dsh-embedded-workbench`; `npm test`; `npm run verify:m0`; `npm run verify:m1`; `npm pack --dry-run --json`; final diff review |
| 预期结果 | V-M1-01..13 按证据等级通过，V-M1-14 为 `not_applicable`；无未关闭越界变更。 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M1-20260827/runs/T-009/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 失败现象：最终验收失败、越界变更或证据等级混淆。
- 定位顺序：任务日志 → Spec/Plan 映射 → 变更集 → runtime/profile 证据。
- 重试/降级：仅允许回到对应任务修复；若改变范围必须回到 Review Gate。
- 回滚：按 Plan §13 以基线提交精确恢复 M1 代码/配置，保留失败报告和 M0 历史。
- 回传条件：任何 Spec/Plan 变化、rc.2 需求或硬件结论均停止并回传上游。

## 5. 任务级验收汇总

| task_id | 验收项 | 证据等级 | 命令/条件 | 预期结果 | 产物 | 状态 |
|---|---|---|---|---|---|---|
| T-001 | M0 基线可复现 | static/host | `npm test`; `npm run verify:m0` | 12/12、M0 pass | T-001 logs | pass |
| T-002 | Lifecycle 测试契约 | host | `node --test test/lifecycle.test.js` | 覆盖 V-M1-02..10 | test log | pass |
| T-003 | 私有 Lifecycle 实现 | host | lifecycle test suite | 状态、回滚、幂等、timeout、snapshot 全部通过 | lifecycle trace | pass |
| T-004 | Host Fiber Adapter | host | Cordis Host fixture | 同一 Fiber 一对象，单一 disposer | Cordis host log | pass |
| T-005 | 私有模块打包/M0 语义 | build/host | pack dry-run + npm tests + verify:m0 | 五文件 tarball、四 exports、M0 语义通过 | pack manifest | pass |
| T-006 | M1 verifier | static/host/build | `npm run verify:m1` | 结构化 `status=pass` | verifier JSON | pass |
| T-007 | 真实 Cordis disposer | host | apply/unload/failure fixture | 真实 cleanup 成对可关联 | instance trace | pass |
| T-008 | Desktop rc.1 runtime | target | 隔离 DSH_HOME Loader | Settings UI 已复核；live reload/disable-re-enable 按用户决策延期至后续里程碑 | runtime summary | deferred |
| T-009 | 最终集成 Verify | static/host/build/target | 全量命令和 final diff | V-M1-01..11、V-M1-13 通过，V-M1-12 延期，V-M1-14 N/A | final report | ready-for-final-review |

较低等级的静态/主机证据不能替代 Desktop runtime 证据；Desktop runtime 也不能替代真实 Cordis disposer 证据或硬件证据。

## 6. 阻塞与未验证项

| ID | 类型 | 内容 | 影响任务 | 证据/补证动作 | 状态 |
|---|---|---|---|---|---|
| B-01 | 未验证 | M1 生命周期实现、主机故障注入尚未执行 | T-002/T-003/T-004 | 已完成对应 host tests | closed |
| B-02 | 未验证 | npm pack 五文件与 exports 不泄漏尚未执行 | T-005/T-006 | 已完成 pack dry-run + verifier | closed |
| B-03 | 未验证 | 真实 Cordis disposer 关联证据尚未执行 | T-007 | 已完成固定 rc.1 Host fixture | closed |
| B-04 | 延期 | Settings UI 人工复核已通过；Desktop rc.1 同一 Loader live reload/disable-re-enable 无可用入口，Host HMR 在 Web patch 中明确禁用 | T-008/T-009 | 用户已确认延期至后续里程碑（M2+，具体环次待后续 Spec 指定）；M1 不修改官方 DSH/profile，不以其他证据替代该项 | deferred |
| B-05 | 不适用 | MCU/硬件/RTOS/ISR/DMA 未纳入 M1 | T-009 | V-M1-14 固定 `not_applicable` | closed |
| B-06 | 风险 | rc.2 依赖闭包损坏 | T-008 | 只声明 rc.1，不扩展兼容范围 | open |

### 6.1 延期决策

用户已确认将 `B-04 / V-M1-12` 放入后续里程碑（M2+，具体环次待后续 Spec 指定）。该项不再阻塞 M1 Final Review；后续实现必须重新经过独立 Spec/Plan/Task 门禁，不得在本 M1 变更集中修改官方 DSH、当前用户 profile 或产品公共接口。

## 7. 下游交接

- 需求/约束输入：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M1-20260827\spec.md`
- 实施路线输入：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M1-20260827\plan.md`
- 任务清单：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M1-20260827\task.md`
- 阶段级 Agent/Skill 基线：Plan §8A；任务级分配见第 3、4 节。
- 执行规则：按 `T-001 → T-002 → T-003 → T-004 → T-005 → T-006` 顺序；T-007/T-008 在 T-006 后执行；T-008 延期后由 T-009 继续最终验证。
- 代码完成后：交接 Spec、Plan、Task、运行记录和最终变更集给 `workflow-final-review`。
- 新事实回传：改变范围/接口/状态/资源/并发/验收时回传 `workflow-review-gate` 或 `workflow-integration-plan`；不得在执行阶段静默扩 scope。
