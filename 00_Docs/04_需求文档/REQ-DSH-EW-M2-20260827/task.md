# M2 实施任务清单：单 Bundle + 多能力插件

> 本文件由 `workflow-task-breakdown` 根据已批准的 M2 Spec、Plan 和当前工程证据生成。
> 根级 `00_Docs/04_需求文档/task.md` 属于 M0；本文件沿用 M1 的 request-scoped 目录，避免覆盖历史任务清单。

## 1. 元数据

| 字段 | 内容 |
|---|---|
| request_id | `REQ-DSH-EW-M2-20260827` |
| 任务清单版本 | `v0.2` |
| 状态 | `执行中` |
| 项目路径与提交 | `D:\zhuomian\dsh-embedded-workbench @ main / 04f0a4403e86a6583b6ef2dd649cb81fa12e48dc` |
| 输入 spec.md | `D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M2-20260827\spec.md` |
| 输入 plan.md | `D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M2-20260827\plan.md` |
| Spec 力度 | `full` |
| 风险叠加门禁 | `both`：版本化分发门 + 最终 UI 人工验收 |
| 生成时间 | `2026-08-27T20:45:42+08:00` |
| 用户门禁 | `Spec approved；Plan 由用户“进行下一步，plan 的选择和 task.md 文件的产出和执行”明确批准` |
| 阶段级 Agent/Skill 基线 | Plan §3 的 12 个实施任务、Plan 首部 `mcu-workbench:executing-plans` 要求和本清单任务级分配 |
| 执行方式 | 当前主代理在独立 worktree 串行执行；不启用子代理 |
| 下游执行 Skill | `mcu-workbench:workflow-task-execution` + `mcu-workbench:executing-plans` |

可信等级使用 `confirmed`、`user-confirmed`、`inferred`、`unverified`。本清单不新增需求；任何改变安装模型、插件边界、真实接口、资源所有权、通信方式或验收标准的事实必须回传 Spec/Plan。

## 2. 总体任务图

```text
T-001 Workspace 与工具链
  ↓
T-002 Contracts
  ↓
T-003 Reference Provider
  ↓
T-004 Catalog / Resolver
  ↓
T-005 Operation Gate / Controller
  ↓
T-006 Settings
  ↓
T-007 Typert Gateway / Core
  ↓
T-008 根 Bundle 装配
  ↓
T-009 UI Controller
  ↓
T-010 Settings UI
  ↓
T-011 一次安装分发阻断门
  ↓
T-012 rc.2 最终验证与交接
```

- 总体目标：一次安装五个高内聚包，以独立 Fiber 和单能力 Gate 保证 Optional Provider 故障不影响 Core 或兄弟能力，并闭合 Settings、Remote、UI、卸载和设置保留证据。
- 非目标：真实 Build/Flash/Serial/Debug/Git/LVGL/AI/硬件能力，自造通信总线，循环自动重试，模型 Tool，官方 DSH 修改，当前用户 Profile 写入。
- 关键串行链：`T-001 → T-002 → ... → T-012`。
- 可并行任务组：设计上 `T-003` 与部分 `T-004` 可并行，但当前执行策略为串行，避免 workspace、Core manifest、测试和 lockfile 交叉修改。
- 停止条件：Plan §0 任一真实 rc.2 seam 不成立、Optional 安装策略失败、Provider 故障必须回滚 Core/兄弟能力或需要自造总线时，立即停止并回传 Spec v0.2。

## 3. 任务索引

| 顺序 | task_id | 任务名称 | 前置任务 | 主 Agent | 主实现 Skill | 辅助 Skill | 验证等级 | 状态 |
|---:|---|---|---|---|---|---|---|---|
| 1 | T-001 | 建立 workspace、精确工具链和基线门禁 | none | `toolchain-engineer` | `mcu-workbench:tools-build` | `mcu-workbench:tdd` | static/host | pass |
| 2 | T-002 | 实现无框架泄漏的 Contracts | T-001 | `system-architect` | `mcu-workbench:codebase-design` | `mcu-workbench:tdd` | static/host/build | pass |
| 3 | T-003 | 迁移 Reference Provider 私有生命周期 | T-002 | `firmware-engineer` | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:tdd` | host/build | pass |
| 4 | T-004 | 实现 Catalog 与 import 前兼容检查 | T-003 | `system-architect` | `mcu-workbench:codebase-design` | `mcu-workbench:tdd` | host/build | pass |
| 5 | T-005 | 实现单能力 Gate 与 Core Controller | T-004 | `firmware-engineer` | `mcu-workbench:tdd` | `mcu-workbench:codebase-design` | host | pass |
| 6 | T-006 | 注册 Settings 唯一事实源 | T-005 | `firmware-engineer` | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:tdd` | host | pass |
| 7 | T-007 | 实现 Typert Gateway、生成物和 Core 组合根 | T-006 | `toolchain-engineer` | `mcu-workbench:tools-build` | `mcu-workbench:tdd` | host/build | pass |
| 8 | T-008 | 将根包收敛为 Bundle 装配层 | T-007 | `system-architect` | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:tools-build` | static/host/build | pass |
| 9 | T-009 | 实现 UI Controller 状态同步 | T-008 | `firmware-engineer` | `mcu-workbench:tdd` | `mcu-workbench:frontend-excellence` | host | not-run |
| 10 | T-010 | 实现 Settings UI 与持续错误提示 | T-009 | `firmware-engineer` | `mcu-workbench:frontend-excellence` | `mcu-workbench:tdd` | host/build | not-run |
| 11 | T-011 | 执行一次安装分发阻断门 | T-010 | `verification-engineer` | `mcu-workbench:tools-verification` | `mcu-workbench:tools-build` | static/build/runtime | not-run |
| 12 | T-012 | 完成 rc.2 隔离、回归和最终交接 | T-011 | `verification-engineer` | `mcu-workbench:tools-verification` | `mcu-workbench:workflow-final-review` | static/host/build/runtime/UI | not-run |

## 4. 任务详情

### T-001：建立 workspace、精确工具链和基线门禁

| 字段 | 内容 |
|---|---|
| order | `1` |
| parallel_group | `none` |
| source_plan_ids | `Plan 任务 1` |
| source_spec_ids | `F-M2-01/02/07`、`V-M2-01/02` |
| owner_agent | `toolchain-engineer` |
| support_agents | `verification-engineer` |
| owner_skill | `mcu-workbench:tools-build` |
| supporting_skills | `mcu-workbench:tdd`, `mcu-workbench:tools-verification` |
| allocation_evidence | workspace、tsconfig、精确依赖和 lockfile 属于构建边界；Plan 要求先运行 M1 基线再写红灯测试。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标与范围

- 输出：四个 workspace manifest/tsconfig、根 TypeScript 配置、精确 rc.2 工具链、lockfile、忽略规则和 workspace contract test。
- 不包含：任何 Contracts/Core/UI/Provider 业务实现。
- 文件：`package.json`、`package-lock.json`、`.gitignore`、`tsconfig*.json`、`packages/*/{package.json,tsconfig.json}`、`test/workspace-contract.test.js`。
- 层：Build/Composition。

#### 执行与约束

1. 在独立 worktree 运行 `npm test`、`npm run verify:m0`、`npm run verify:m1` 和 `git status`，保存基线。
2. 先写 workspace 红灯测试，确认因缺少 `workspaces` 失败。
3. 按 Plan 精确建立五包版本、依赖方向、scripts 和 project references；执行 `npm install --ignore-scripts`。
4. Provider 仅在 `optionalDependencies`；Contracts 无框架依赖；所有 DSH direct dependency 为 rc.2。
- SOLID：SRP=包职责分开；ISP=manifest 最小依赖；DIP=根 Bundle 只组合抽象包。
- 资源：只产生可再生 `node_modules/lib`；不访问用户 Profile、网络以外的外部运行资源或硬件。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host` |
| 命令或条件 | `npm test`; `npm run verify:m0`; `npm run verify:m1`; `node --test test/workspace-contract.test.js` |
| 预期结果 | 基线全绿；红灯先出现；实现后 workspace 测试通过；rc.1 不再作为 M2 direct dependency。 |
| 产物位置 | Git commit 与测试输出 |
| 当前状态 | `pass（执行前基线）`：T-001 修改前 `npm test` 21/21、`verify:m0`、`verify:m1` 均通过；workspace 测试红灯 3/3 后绿灯 3/3；`npm install --ignore-scripts` 和 `npm ls --depth=0` 通过。M2 依赖/`prepack` 已使旧 M0/M1 根回归语义失效，完整根回归迁移见 `B-M2-06` / T-012。 |

- 失败：基线失败先定位环境/历史回归；依赖解析失败不放宽版本。
- 回滚：revert T-001 独立提交；不改写 M0/M1 历史。
- 回传：真实 rc.2 包无法解析或 workspace 边界需变化时回 Plan/Spec。

### T-002：实现无框架泄漏的 Contracts

| 字段 | 内容 |
|---|---|
| order | `2` |
| source_plan_ids | `Plan 任务 2` |
| source_spec_ids | `V-M2-01/02/03/19` |
| owner_agent | `system-architect` |
| support_agents | `verification-engineer` |
| owner_skill | `mcu-workbench:codebase-design` |
| supporting_skills | `mcu-workbench:tdd` |
| allocation_evidence | 稳定 DTO、错误码、版本契约与 JSON-safe 快照属于架构公共边界。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标、步骤与边界

- 先写 Contract major、精确 provider version、非法版本、未知枚举、深冻结和 JSON 序列化红灯测试。
- 实现 Plan §2 固定类型、常量、`isContractCompatible()` 和 `freezeJsonSnapshot()`。
- 禁止依赖 Cordis、DSH、React、Core 或 Provider；禁止返回 Context/Fiber/Promise/Error/可变内部数组。
- 所有权：函数只返回深复制、深冻结的 JSON-safe 值，无持久资源、timer 或动态运行句柄。
- SOLID：ISP=最小公共契约；DIP=Core/UI/Provider 共同依赖 Contracts；LSP=版本和错误语义不得漂移。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host/build` |
| 命令或条件 | `npx tsx --test packages/workbench-contracts/test/contracts.test.ts`; `npx tsc -p packages/workbench-contracts/tsconfig.json --noEmit`; `rg "cordis|dsh-|react|provider-reference" packages/workbench-contracts/src` |
| 预期结果 | 测试/类型检查通过，边界扫描零匹配。 |
| 当前状态 | `pass`：三轮红→绿；6 个 Contracts 测试、TypeScript 6 `--noEmit` 通过；框架/Provider 依赖扫描 0。 |

- 回滚：revert T-002；若固定接口需变化，停止并回 Spec。

### T-003：迁移 Reference Provider 私有生命周期

| 字段 | 内容 |
|---|---|
| order | `3` |
| source_plan_ids | `Plan 任务 3` |
| source_spec_ids | `Q-M2-01/02/11`、`V-M2-04/05/15/19` |
| owner_agent | `firmware-engineer` |
| support_agents | `system-architect` |
| owner_skill | `mcu-workbench:workflow-ai-collab` |
| supporting_skills | `mcu-workbench:tdd`, `mcu-workbench:codebase-design` |
| allocation_evidence | Provider 私有资源栈、生命周期和故障注入是独立实现职责。 |
| confidence | `user-confirmed` |
| status | `pass` |

#### 目标、步骤与边界

- 先覆盖正常、start failure rollback、cleanup failure、1000 ms timeout、双实例隔离红灯测试。
- 迁移 M1 生命周期到 `packages/provider-reference`，发布静态 manifest 和同值代码 manifest。
- 每实例独占资源；资源获取后立即登记 disposer；逆序、有界、逐项清理；一个实例失败不触碰另一实例。
- 正式 Bundle 只允许 failure=`none`；故障模式仅测试 fixture 使用。
- 禁止文件、进程、网络、串口、USB、硬件、Tool API；无 ISR/DMA/RTOS 资源。
- SOLID：SRP=Provider 自有资源；OCP=新增 Provider 实现不改 Core；LSP=manifest 与 Provider contract 一致。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `host/build` |
| 命令或条件 | `npx tsx --test packages/provider-reference/test/provider.test.ts`; `npx tsc -p packages/provider-reference/tsconfig.json --noEmit` |
| 预期结果 | 正常/故障/超时/双实例全部通过且无越界 API。 |
| 当前状态 | `pass`：Reference 测试红灯后 7/7 通过；TypeScript `--noEmit` 通过；非法故障模式、非 1000 ms deadline 和额外配置字段均被运行时拒绝；文件/进程/网络/Tool 越界扫描 0。 |

- 回滚：revert T-003；资源清理语义无法闭合时回 Spec。

### T-004：实现 Catalog 与 import 前兼容检查

| 字段 | 内容 |
|---|---|
| order | `4` |
| source_plan_ids | `Plan 任务 4` |
| source_spec_ids | `V-M2-02/03/06/19` |
| owner_agent | `system-architect` |
| support_agents | `firmware-engineer` |
| owner_skill | `mcu-workbench:codebase-design` |
| supporting_skills | `mcu-workbench:tdd` |
| allocation_evidence | Catalog 是有界状态投影，Resolver 是 Provider 实现与 Core 间的唯一解析边界。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标、步骤与边界

- 先测试 revision、注入时钟、深冻结、固定容量、健康度、单 ID 隔离以及 MISSING/INCOMPATIBLE 时 import 次数为 0。
- Catalog 只拥有快照；不拥有 Provider 资源。Resolver 从 Bundle `packageBaseUrl` 读取静态 manifest，兼容后才 import。
- 校验 package name、capability ID、provider version、contract major 和静态/代码 manifest 漂移。
- 每能力只保留当前状态，不保存无界错误历史；错误映射必须可定位。
- SOLID：SRP=Catalog/Resolver 分离；OCP=描述符扩展；DIP=Core 依赖 Provider contract 而非私有实现。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `host/build` |
| 命令或条件 | `npx tsx --test packages/workbench-core/test/catalog.test.ts packages/workbench-core/test/provider-resolver.test.ts` |
| 预期结果 | 不兼容/缺失不执行 Provider 代码；A 状态变化不影响 B。 |
| 当前状态 | `pass`：8 个 Catalog/Resolver 主机测试、Core TypeScript `--noEmit` 通过；missing/版本/Contract 不兼容均在 import 前验证为 0 次 import；Core 私有 Provider import 扫描 0。 |

- 回滚：revert T-004；若 pnpm 真实解析路径不同，保留证据并回 Plan。

### T-005：实现单能力 Operation Gate 与 Core Controller

| 字段 | 内容 |
|---|---|
| order | `5` |
| source_plan_ids | `Plan 任务 5` |
| source_spec_ids | `V-M2-04/05/07/08/14/15/19` |
| owner_agent | `firmware-engineer` |
| support_agents | `system-architect` |
| owner_skill | `mcu-workbench:tdd` |
| supporting_skills | `mcu-workbench:codebase-design` |
| allocation_evidence | 同能力串行、异能力独立和 child Fiber 所有权需要并发状态机测试先行。 |
| confidence | `user-confirmed` |
| status | `pass` |

#### 目标、步骤与边界

- 红灯覆盖：重复 reconcile 同 Promise、`true→false→true` 最终收敛、异能力并行、A 失败 B 运行、cleanup failure 继续清 B。
- 每能力独立 Gate，仅一个 `drainPromise`、generation、Fiber 引用；不同能力无全局锁。
- 启动顺序固定为 resolve→兼容→import→child Fiber→await→再读 desired；禁止幽灵 RUNNING。
- 停止只 dispose 当前 Provider Fiber；残留或清理失败转 `FAILED + RESTART_REQUIRED`，禁止原地 retry。
- Promise 晚到必须被观察，不能产生 unhandled rejection 或复活旧状态。
- SOLID：SRP=Gate 串行化、Controller 状态编排；LSP=所有 Provider 同一启停语义；故障不得跨能力传播。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | `npx tsx --test packages/workbench-core/test/operation-gate.test.ts packages/workbench-core/test/controller.test.ts` |
| 预期结果 | 快速切换资源成对；A 失败/清理失败不影响 B/Core。 |
| 当前状态 | `pass`：13 个 Core 主机测试、真实 Cordis 4.0.1 Context/Fiber 测试与 TypeScript `--noEmit` 通过；同能力 Promise 身份一致、异能力无全局锁、故障与 cleanup 残留均不跨能力传播。 |

- 回滚：revert T-005；若 Cordis child failure 强制回滚 Core，停止并回 Spec。

### T-006：注册 Settings 唯一事实源

| 字段 | 内容 |
|---|---|
| order | `6` |
| source_plan_ids | `Plan 任务 6` |
| source_spec_ids | `Q-M2-07/08/09/13/14`、`V-M2-09` |
| owner_agent | `firmware-engineer` |
| support_agents | `system-architect` |
| owner_skill | `mcu-workbench:workflow-ai-collab` |
| supporting_skills | `mcu-workbench:tdd` |
| allocation_evidence | Settings owner 负责唯一 desired 事实源及差量协调，不拥有 Provider 生命周期。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标、步骤与边界

- Fake 已验证的 rc.2 scope `get/watch/update/replace`，先测试默认值、单 ID 差量、单能力写入失败隔离、dispose 保留文档；Client revision 冲突留至 T-009 并以真实接口为准。
- 注册唯一 namespace `dsh-embedded-workbench`；只保存 `capabilities[id].enabled`。
- watcher 仅 reconcile 变化 ID；错误落到该能力 `settings` 阶段，不停止其他能力。
- 普通卸载只释放 watcher/runtime scope，不清持久设置；显式 reset 才清 Workbench namespace。
- SOLID：SRP=Settings 只持 desired；ISP=仅暴露必要 schema；Core 实际状态不得反写覆盖 desired。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | `npx tsx --test packages/workbench-core/test/settings.test.ts` |
| 预期结果 | 默认值、初始 desired、单能力错误隔离、差量 reconcile 和普通 dispose 不写 Settings 文档通过；实际持久化/重装恢复留待 T-011 隔离 rc.2 runtime。 |
| 当前状态 | `pass`：真实 rc.2 `settingsNamespace("dsh-embedded-workbench")` 已接受；3 个 Settings Owner 主机测试和 Core 全量 16 个测试通过。Owner 仅注册/读取/watch，不调用 `update/replace`，dispose 仅释放 watcher；未创建替代存储或通信总线。 |

- 回滚：revert T-006；真实 Settings 签名不符则停止并回 Spec。

### T-007：实现 Typert Gateway、生成物和 Core 组合根

| 字段 | 内容 |
|---|---|
| order | `7` |
| source_plan_ids | `Plan 任务 7` |
| source_spec_ids | `F-M2-10/11/12`、`V-M2-08/10` |
| owner_agent | `toolchain-engineer` |
| support_agents | `firmware-engineer` |
| owner_skill | `mcu-workbench:tools-build` |
| supporting_skills | `mcu-workbench:tdd`, `mcu-workbench:workflow-ai-collab` |
| allocation_evidence | Typert 生成和 package exports 属于构建闭包，Gateway/Core 组合遵循官方 rc.2 seam。 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标、步骤与边界

- 先测唯一 namespace、未知 ID 拒绝、cleanup 残留 retry 拒绝、list 深冻结。
- Gateway 仅提供 `list/retry/reconcile`；不新增 Event、bus、WebSocket 或 Tool。
- Core 创建顺序 Catalog→Controller→Settings→Gateway→allSettled reconcile；逆序释放且逐 Provider 清理。
- 调用真实 `WorkspaceTypertGenerator.generate([core],[host])`，生成严格 Host/Remote artifacts 并断言三方法；2026-08-28 用户允许使用只读官方 checkout 的系统临时 analysis overlay。overlay 仅复制 Protocol、Contracts/Core 到 `<temp>/packages`，始终删除，不进入发布包或运行时依赖。
- SOLID：ISP=Remote 三方法；DIP=UI 依赖生成 descriptor；SRP=Gateway 只做边界校验和转发。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `host/build` |
| 命令或条件 | `npx tsx --test packages/workbench-core/test/gateway.test.ts`; `npx tsc -b`; `node scripts/generate-typert.mjs` |
| 预期结果 | 仅三方法、strict schema、未知字段拒绝；生成物可导入。 |
| 当前状态 | `pass`：Gateway 三项主机测试（含 Core Settings observer/Reference 生命周期释放）通过；`npx tsc -b`、真实 rc.2 analysis overlay 生成、Host artifact import 均通过。生成方法集严格为 `list,reconcile,retry`；真实 `TypertGatewayService` 对含额外字段的 `retry` 调用返回 `arguments-invalid`，业务方法未执行。 |

- 回滚：revert T-007；真实 generator API 不符时停止并回 Spec，不手写协议替代。

### T-008：将根包收敛为 Bundle 装配层

| 字段 | 内容 |
|---|---|
| order | `8` |
| source_plan_ids | `Plan 任务 8` |
| source_spec_ids | `Q-M2-03/04/06`、`V-M2-01/02/10/12` |
| owner_agent | `system-architect` |
| support_agents | `toolchain-engineer` |
| owner_skill | `mcu-workbench:workflow-ai-collab` |
| supporting_skills | `mcu-workbench:tools-build`, `mcu-workbench:tdd` |
| allocation_evidence | 根包只作为唯一安装入口、Provider 描述符和 Host/Client 组合根。 |
| confidence | `user-confirmed` |
| status | `pass` |

#### 目标、步骤与边界

- 先修改根测试，确认旧 M1 lifecycle/手写 UI 入口导致红灯。
- `src/providers.js` 只保存 Reference 描述符，不 import 实现；Host 注册生成 Typert 并启动一个 Core child Fiber。
- Client 只挂载生成 Remote descriptor；esbuild 生成 ModuleLoader-compatible 根/UI client。
- 保留唯一 Loader row 和根包身份；required 三包为 dependency，Reference 为 optionalDependency。
- 释放顺序：Core Fiber 后 Typert registration；失败路径也对称。
- SOLID：Composition Root 负责注入；Core/UI 不访问 Provider 私有实现；稳定入口对扩展开放。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host/build` |
| 命令或条件 | `npm run build`; `node --test test/backend.test.js test/package-contract.test.js` |
| 预期结果 | 单 row、描述符零实现 import、Host/Client 使用官方 seam，构建通过。 |
| 当前状态 | `pass`：4 个根包主机测试通过；Host 按 `Typert register → Core Fiber await` 装配，startup 失败及正常释放均逆序 `Core dispose → Typert unregister`；`npm run build` 生成 ModuleLoader Client，VM probe 确认仅暴露 `inject=["remote"]` 并执行生成 Remote 的 `$mount`。 |

- 回滚：revert T-008；需要官方源码修改或额外总线时停止。

### T-009：实现 UI Controller 状态同步

| 字段 | 内容 |
|---|---|
| order | `9` |
| source_plan_ids | `Plan 任务 9` |
| source_spec_ids | `V-M2-08/09/11/19` |
| owner_agent | `firmware-engineer` |
| support_agents | `verification-engineer` |
| owner_skill | `mcu-workbench:tdd` |
| supporting_skills | `mcu-workbench:frontend-excellence` |
| allocation_evidence | 状态同步、并发写入和 timer 对称清理需 Fake clock 与边界测试先行。 |
| confidence | `confirmed` |
| status | `not-run` |

#### 目标、步骤与边界

- 先测 open/write/retry/reconcile/reconnect 刷新；仅瞬态 500 ms 轮询，最多 20 次；dispose 后 timer=0。
- `setEnabled()` 基于最新 scope snapshot 克隆并只改目标 ID；写入后 reconcile 并重读确认。
- revision/只读冲突不以 UI 草稿覆盖 Host；保留 Host 最新值并显示 settings 错误。
- Controller 只保存当前 snapshot、loading/error、一个 timeout 和订阅；不保存历史。
- dispose 清 subscription、connection disposer、timeout，并等待 in-flight 操作 settle。
- SOLID：SRP=Controller 做同步不做视图；ISP=仅 Settings/Remote seam；资源有界。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | `npx tsx --test packages/workbench-ui/test/controller.test.ts` |
| 预期结果 | 状态最终一致、冲突不覆盖、timer/订阅对称释放。 |
| 当前状态 | `not-run` |

- 回滚：revert T-009；Client seam 与真实 rc.2 不符时回 Spec。

### T-010：实现 Settings UI 与持续错误提示

| 字段 | 内容 |
|---|---|
| order | `10` |
| source_plan_ids | `Plan 任务 10` |
| source_spec_ids | `Q-M2-05/07/08`、`V-M2-11/16` |
| owner_agent | `firmware-engineer` |
| support_agents | `verification-engineer` |
| owner_skill | `mcu-workbench:frontend-excellence` |
| supporting_skills | `mcu-workbench:tdd` |
| allocation_evidence | Settings section、能力卡片、错误和 restart required 是独立 Client 视图职责。 |
| confidence | `user-confirmed` |
| status | `not-run` |

#### 目标、步骤与边界

- 先测原 section id/label、四维状态、错误跨 rerender 持续、只读禁用、需要重启、单 ID retry、reset 确认。
- UI 只绑定 `settingsScope` 和生成 Remote；不 import Core 私有对象或 Provider 实现。
- `MISSING/INCOMPATIBLE/FAILED` 持续显示“能力不可用”及可定位详情，直到修复、禁用或状态改变。
- LIVE 且安全时即时 reconcile；cleanup 残留显示“需要重启”并禁止原地 retry。
- esbuild 仅 externalize React runtime；无全局 listener、事件总线或无界缓存。
- SOLID：SRP=视图渲染/交互；ISP=每能力最小操作；错误隔离不影响其他卡片。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `host/build` |
| 命令或条件 | `npm run build`; `npx tsx --test packages/workbench-ui/test/controller.test.ts packages/workbench-ui/test/client.test.tsx`; `node --test test/client.test.js` |
| 预期结果 | UI 契约测试和 ModuleLoader 构建通过。 |
| 当前状态 | `not-run` |

- 回滚：revert T-010；不以 HTTP 200 代替最终 UI 人工验收。

### T-011：执行一次安装分发阻断门

| 字段 | 内容 |
|---|---|
| order | `11` |
| source_plan_ids | `Plan 任务 11` |
| source_spec_ids | `R-M2-01/06`、`V-M2-06/09/12/13/17` |
| owner_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:tools-build`, `mcu-workbench:tools-quality` |
| allocation_evidence | 一次 add、Optional 缺失、精确 remove 和设置保留是版本化分发阻断门。 |
| confidence | `unverified` |
| status | `not-run` |

#### 目标、步骤与边界

- 先建立不调用 `npm pack` 的静态 `verify:m2`，避免 prepack 递归。
- 本地 registry 只绑定 `127.0.0.1` 随机端口，仅服务本轮五个 tarball；其他 package 404。
- 使用项目内隔离 `DSH_HOME`/npmrc 和真实 rc.2 执行一次 `dsh plugin add`。
- 分别验证完整 Optional、Reference metadata 缺失、remove+settings 保留+重装恢复。
- 写入/删除只限已解析并验证位于本轮临时根的路径；不写当前用户 Profile，不改官方 DSH。
- 后台 registry/DSH 进程记录 PID、端口并有界停止；证据目录保留到最终 Verify。
- SOLID：分发失败不得改变运行时包边界；Optional 失败必须被 Core 投影为 DEGRADED。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/build/runtime` |
| 命令或条件 | `npm run verify:m2:runtime` |
| 预期结果 | JSON 中 `install_one_command`、`optional_missing_degraded`、`settings_preserved`、`other_profile_hash_unchanged` 全为 true。 |
| 当前状态 | `not-run` |

- 阻断：Optional 缺失导致 add 非零、settings 被 remove 清除或其他 profile/hash 变化时立即停止。
- 回滚：仅精确停止本轮 PID、移除本轮 package/profile；不得递归删除未验证路径。
- 回传：失败按 Plan §0 回 Spec v0.2，禁止静默切换 B2。

### T-012：完成 rc.2 隔离、回归和最终交接

| 字段 | 内容 |
|---|---|
| order | `12` |
| source_plan_ids | `Plan 任务 12` |
| source_spec_ids | `V-M2-01..20` |
| owner_agent | `verification-engineer` |
| support_agents | `system-architect`, `toolchain-engineer` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:workflow-final-review`, `mcu-workbench:tools-quality` |
| allocation_evidence | 最终任务闭合真实 Cordis、rc.2 runtime、UI、pack、零 Tool、回归和 SOLID 证据。 |
| confidence | `confirmed` |
| status | `not-run` |

#### 目标、步骤与边界

- 用真实 Cordis 4.0.1 验证健康/启动失败/清理失败多 Provider 隔离和 Core ACTIVE。
- 完善静态五包、依赖方向、Typert 三方法、唯一 namespace、零 Tool、无循环 timer、pack files 检查。
- 修订 M0/M1 回归断言到 M2 合法边界；删除旧根 lifecycle/client 源文件及旧根 lifecycle 测试。
- 执行完整自动验证和 `npm pack --dry-run --json`，记录退出码与证据等级。
- 人工 UI 验收默认启用、即时开关、持续不可用、需要重启、只读、reset 确认。
- 不把 Desktop rc.2 runtime/UI 证据外推为 MCU、硬件、串口、调试器或 M1 顶层 Loader reload 完成。
- SOLID 最终门：SRP/OCP/LSP/ISP/DIP 均需代码位置、测试和依赖扫描证据；任一 blocked 不放行。

#### 验证与回滚

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host/build/runtime/UI`；target board/physical=`not_applicable` |
| 命令或条件 | `npm run build`; `npm test`; `npm run verify:m0`; `npm run verify:m1`; `npm run verify:m2`; `npm run verify:m2:runtime`; `npm pack --dry-run --json`; `git diff --check`；隔离 Web UI 人工验收 |
| 预期结果 | 自动门全 0；UI 契约通过；无 Tool 增量、timer、悬挂 disposer、unhandled rejection；兄弟能力隔离成立。 |
| 当前状态 | `not-run` |

- 回滚：按独立任务 commit 逆序 revert；整体锚点为本 task 文档提交后的执行基线。
- 回传：任何 Spec 不变量变化或证据不足，交回 `workflow-review-gate`；代码完成后交 `workflow-final-review`。

## 5. 任务级验收汇总

| task_id | 验收项 | 证据等级 | 命令/条件 | 预期结果 | 状态 |
|---|---|---|---|---|---|
| T-001 | workspace 与精确 rc.2 工具链 | static/host | workspace test + M0/M1 baseline | 单入口四 workspace、版本精确 | pass |
| T-002 | Contracts 稳定且无框架泄漏 | static/host/build | contracts test + tsc + rg | JSON-safe、兼容检查、零框架依赖 | pass |
| T-003 | Reference 实例和资源隔离 | host/build | provider test + tsc | 故障/超时不跨实例 | pass |
| T-004 | import 前兼容 | host | catalog/resolver tests | missing/incompatible import=0 | pass |
| T-005 | Gate/Controller 故障隔离 | host | gate/controller tests | 最新 desired 收敛，A 不影响 B | pass |
| T-006 | Settings 唯一 desired 源 | host | Settings Owner 3 tests + Core 16 tests + `settingsNamespace("dsh-embedded-workbench")` | 合法 namespace、初始/差量 desired、单项错误隔离和 watcher 释放通过；runtime 持久化留 T-011 | pass |
| T-007 | Typert 三方法和 Core 清理 | host/build | Gateway 3 tests + `tsc -b` + rc.2 overlay generator + Host Gateway unknown-field probe | 严格 artifact 生成；仅 `list/reconcile/retry`，未知字段 `arguments-invalid`，Core 释放 Settings observer | pass |
| T-008 | 单 Bundle 装配 | static/host/build | 4 root tests + `npm run build` + ModuleLoader VM probe | 单 row；声明式 Provider；Host/Core 和 Client/Remote 均使用 rc.2 seam | pass |
| T-009 | UI 状态同步资源有界 | host | controller fake-clock tests | timer/订阅对称 | not-run |
| T-010 | Settings UI 持续错误/重启提示 | host/build | UI tests + build | 每能力独立控制与错误 | not-run |
| T-011 | 一次安装和精确卸载 | runtime | `verify:m2:runtime` | Optional 缺失可降级、设置保留 | not-run |
| T-012 | 全量回归与人工 UI | static/host/build/runtime/UI | 全门禁 + UI checklist | V-M2-01..20 闭合 | not-run |

静态、主机、构建、Desktop rc.2 runtime、UI 人工、目标板和实物证据必须分开。M2 不涉及 MCU，target board/physical 固定为 `not_applicable`。

## 6. 阻塞与未验证项

| ID | 类型 | 内容 | 影响任务 | 补证动作 | 状态 |
|---|---|---|---|---|---|
| B-M2-01 | 未验证/阻断门 | `optionalDependencies` 在真实 `dsh plugin add/remove` 下的容错和回滚语义 | T-011/T-012 | 本地 registry + 隔离 rc.2 profile | open |
| B-M2-02 | 已解决/host-build | 用户指定的只读官方源码 `D:\deepseek-harness-rc2 @ dsh-v0.1.1-rc.2 / b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` 被临时 overlay 使用；Protocol、Contracts/Core 同处 `<temp>/packages` 后，rc.2 generator 生成一个严格 Host/Client artifact，finally 删除本次 overlay | T-007/T-008 | 生成的三方法与额外字段拒绝已验证；T-008 继续使用 artifact，不改官方 checkout | closed |
| B-M2-03 | 未验证/阻断门 | child Fiber 启动/清理失败后 Core 与兄弟 Fiber 保持 active | T-005/T-012 | Fake + 真实 Cordis 4.0.1 测试 | open |
| B-M2-04 | 未验证 | Settings 普通卸载保留与重装恢复 | T-006/T-011 | 隔离 settings.yaml remove/reinstall 对比 | open |
| B-M2-05 | 风险/非阻断 | UI 人工验收需要隔离 rc.2 Web 实例 | T-012 | 自动门通过后启动隔离 Web 并记录观察 | open |
| B-M2-06 | 已知回归迁移 | T-001 的 M2 workspace/精确依赖/prepack 已与旧 M0/M1“单包、零 dependency/Remote、rc.1”断言冲突；完整根 `npm test`/`verify:m0`/pack 暂非通过证据 | T-012 | 按 Plan 任务12 重写为 M2 合法的单 row、零 Tool、Reference lifecycle、精确 pack 回归；T-007/T-008 补齐 build/prepack 脚本后复跑 | open |
| B-M2-07 | 已解决/用户确认 | 原 camelCase namespace 被 rc.2 `settingsNamespace()` 拒绝；用户于 2026-08-28 确认采用已实测合法的 `dsh-embedded-workbench` | T-006..T-012 | Spec/Plan/task v0.2 已同步；T-006 仅使用真实 Settings seam 实施 | closed |

## 7. SOLID 固定交接

| 字段 | 当前值 |
|---|---|
| solid_status | `pass（设计分解）；代码证据待各 Task 执行` |
| SRP | `pass`：Bundle/Contracts/Core/UI/Provider 与 Catalog/Resolver/Gate/Settings/Gateway 职责分离 |
| OCP | `pass`：Provider 通过描述符与 Contract 扩展，不修改稳定 Core 私有逻辑 |
| LSP | `pass`：manifest、版本、启停、错误、清理和快照契约由测试约束 |
| ISP | `pass`：Remote 仅三方法；Contracts 与 Settings schema 最小化；无 Tool/总线 |
| DIP | `pass`：UI/Core/Provider 依赖 Contracts；Provider 实现由 Bundle 描述符和 Core Fiber 注入 |
| evidence | `spec.md` §3/5/8、`plan.md` §1/2/3/5；代码/测试行号随执行回写 |
| violations | `none；若实现需要 Core import Provider 私有路径、自造总线或共享全局锁则 blocked` |
| spec_version | `M2 spec v0.1 approved @ 04f0a44 execution baseline` |

## 8. 下游交接

- 需求输入：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M2-20260827\spec.md`
- 实施路线：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M2-20260827\plan.md`
- 任务清单：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\REQ-DSH-EW-M2-20260827\task.md`
- 执行规则：独立 worktree；严格按 T-001→T-012；每次只执行一个任务；先红灯再实现；每任务测试、AI/SOLID 复核、回写证据并独立提交。
- 评审点：每完成 3 个任务执行一次变更范围和回归检查；阻断门失败立即停止，不用替代架构绕过。
- 代码完成后：交接 `mcu-workbench:workflow-final-review`。
- 新事实回传：任务粒度/命令问题回 `workflow-integration-plan`；范围、接口、安装模型、资源、权限或验收变化回 `workflow-review-gate`。
