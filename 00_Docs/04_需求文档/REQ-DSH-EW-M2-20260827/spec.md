# DSH Embedded Workbench M2 Spec

> 版本：v0.1
> request_id：`REQ-DSH-EW-M2-20260827`
> 项目：`D:\zhuomian\dsh-embedded-workbench`
> 基线提交：`e9edbd8`
> 兼容基线：DeepSeek Harness `0.1.1-rc.2`
> 选定方向：方案 B——单 Bundle + 多能力插件
> Spec 状态：`awaiting-written-review`
> 代码阶段判定：`禁止进入代码阶段`

本 Spec 建立在 M0 最小插件注册和 M1 私有生命周期基线之上。M0/M1 文档及 rc.1
证据保持冻结；M2 重新以当前安装的 DSH `0.1.1-rc.2` 建立兼容和运行证据，不把历史
rc.1 结果外推为 M2 兼容结论。

## 0. 目标、范围与非目标

### 0.1 目标

把 Embedded Workbench 演进为“一次安装、内部多插件”的能力容器。每项能力保持高内聚、
低耦合，拥有独立的生命周期、状态、错误和清理路径；任一 Optional 能力缺失、禁用、版本
不兼容或运行失败时，Workbench Core 与其他能力仍可运行，并在 Settings 中持续显示可定位
的降级状态。

### 0.2 M2 直接范围

1. 保留 `@dsh-embedded/dsh-embedded-workbench` 作为唯一用户安装入口和 M0 包身份；
2. 建立 Bundle、Contracts、Core Supervisor、UI Shell 和 Optional Provider 的边界；
3. 建立 Provider 发现、Contract 版本校验、独立 Cordis Fiber、启停和失败隔离；
4. 建立最小控制平面：启用状态持久化、单能力启停、状态查询和手动重试；
5. Settings 支持逐个控制 Optional Provider 的启动；能安全即时切换时立即生效，否则持续
   显示 `RESTART_REQUIRED`；
6. Optional Provider 不可用时允许 Workbench 以 `DEGRADED` 启动，并持续显示错误，直到
   修复或用户禁用该能力；
7. 复用 DSH rc.2 的 `ctx.settings/settingsScope`、Typert Remote、Connection 和 Cordis
   `ctx.plugin()/Fiber` seam，不新建通信总线；
8. 只实现一个无硬件副作用的 Reference Provider，用于闭合发现、启停、失败注入、降级、
   持久化和 UI 状态链路；
9. 使用隔离 `DSH_HOME` 验证一次安装、真实 rc.2 Loader、Settings、Remote、UI 和精确卸载。

### 0.3 明确非目标

- 不实现真实 Build、Flash、Serial、Debug、Git、LVGL、AI 或硬件能力；
- 不访问文件工程、外部进程、网络、串口、USB、调试器、MCU、RTOS、ISR 或 DMA；
- 不注册模型 Tool、Service Tool、Provider Tool 或 Agent 可调用工具；
- 不建立通用事件总线、日志 UI、历史审计库或 M5 实时推送系统；
- 不实现 Reference Provider 之外的业务 Provider；
- 不实现高风险能力的独立 Worker 进程；仅保留未来进程隔离边界；
- 不实现除 `desired_enabled` 及其必要 schema 之外的业务配置；完整配置仍属于 M4；
- 不修改官方 DSH、当前用户 Profile、`mcu-workbench` 或 `embedded_framework`；
- 不发布 npm/市场版本，不承诺 rc.1 兼容；
- 不把 M2 子 Provider 启停描述为已关闭 M1 延期的顶层 Workbench Loader reload 验证。

## 1. 用户已确认决策

| ID | 决策 | 可信等级 |
|---|---|---|
| Q-M2-01 | 任一功能不得影响其他功能；高内聚、低耦合是硬性要求 | `user-confirmed` |
| Q-M2-02 | 普通 UI/逻辑能力使用同进程 Fiber 隔离；未来高风险硬件能力预留独立进程隔离 | `user-confirmed` |
| Q-M2-03 | 对用户只提供一次 Bundle 安装 | `user-confirmed` |
| Q-M2-04 | Core/UI 为 required；Optional 能力缺失或失败时 Workbench 仍启动并报错 | `user-confirmed` |
| Q-M2-05 | Settings 持续显示“能力不可用”，直到修复 | `user-confirmed` |
| Q-M2-06 | 采用方案 B：单 Bundle + 多能力插件 | `user-confirmed` |
| Q-M2-07 | Settings 可逐个控制 Optional Provider 启停 | `user-confirmed` |
| Q-M2-08 | 能安全即时切换则立即生效，否则明确提示需要重启 | `user-confirmed` |
| Q-M2-09 | M2 纳入最小控制平面；完整配置和通用事件系统仍留在 M4/M5 | `user-confirmed` |
| Q-M2-10 | M2 兼容基线升级到 DSH `0.1.1-rc.2`；rc.1 仅为历史证据 | `user-confirmed` |
| Q-M2-11 | M2 只用 Reference Provider 闭合架构，不提前实现真实能力 | `user-confirmed` |
| Q-M2-12 | M2 不循环自动重试，只提供手动重试和依赖变化后的单次 reconcile | `user-confirmed` |
| Q-M2-13 | 普通卸载保留 Workbench 设置；显式“重置工作台设置”才清除 | `user-confirmed` |

## 2. 当前工程事实与真实接口

| ID | 事实 | 证据 | 可信等级 | M2 影响 |
|---|---|---|---|---|
| F-M2-01 | M1 Final Review 已通过，当前提交为 `e9edbd8` | Git 与 M1 workflow state | `confirmed` | M2 回滚锚点 |
| F-M2-02 | 当前产品是一个 package、一个 Loader row、Host/Client 双入口 | `package.json`、`cordis.patch.yml` | `confirmed` | 保留安装入口，重构内部边界 |
| F-M2-03 | M1 只有私有 `WorkbenchLifecycle`，没有 Service/Tool/Registry | M1 Spec 与 `src/` | `confirmed` | M2 首次引入最小内部控制面 |
| F-M2-04 | Cordis Fiber 提供依赖状态、effect、`await()`、`dispose()`、`restart()` | 当前 `@deepseek-ai/cordis` 4.0.1 源码 | `confirmed` | Provider 独立生命周期基础 |
| F-M2-05 | Loader Entry 更新 `disabled` 可启停单 entry，并在失败时回滚 | `cordis-plugin-loader/src/config/entry.ts` | `confirmed` | 安全即时切换的框架先例 |
| F-M2-06 | EntryGroup 中任一 child apply 失败会使整个 group update 回滚 | `cordis-plugin-loader/src/config/group.ts:59-105` | `confirmed` | 禁止直接用朴素 Group 承担 Optional 故障隔离 |
| F-M2-07 | 当前安装的 DSH 及 API/Client/Settings 相关包均为 `0.1.1-rc.2` | `F:\DSH Desktop\resources\app\node_modules\@deepseek-ai\*/package.json` | `confirmed` | M2 版本基线 |
| F-M2-08 | `ctx.settings` 支持 namespace、schema、revision、串行写入和持久化 | `@deepseek-ai/dsh-settings`、`dsh-settings-file` | `confirmed` | `desired_enabled` 的事实源 |
| F-M2-09 | Client `settingsScope` 通过 Connection API 读写 Host Settings | `dsh-client-ui-settings/lib/client.js` | `confirmed` | Settings UI 不自建存储 |
| F-M2-10 | `TypertRemoteService` + Remote descriptor 可生成 `ctx.remote.<namespace>` | `dsh-typert-protocol`、`dsh-api-gateway` | `confirmed` | Host 状态查询和重试入口 |
| F-M2-11 | 官方 `pluginInventory.list()` 已按上述 Typert Remote 模式提供 Loader 状态 | `dsh-host-plugin-inventory`、对应 Client | `confirmed` | M2 Remote 设计先例 |
| F-M2-12 | Remote Event 仅转发官方固定 allowlist，未发现插件动态扩展事件的公开 seam | `dsh-api-remotes` 的 `API_REMOTE_FORWARDED_EVENTS` | `confirmed` | M2 使用查询和有界轮询，不修改官方 allowlist |

## 3. 总体架构与依赖方向

```text
@dsh-embedded/dsh-embedded-workbench  （唯一安装入口）
│
├─ Bundle Composition
│  └─ 只负责包组合、精确版本和 Provider 描述符
│
├─ Workbench Contracts                required
│  └─ ID / DTO / Schema / 错误码 / Contract 版本
│
├─ Workbench Core Supervisor          required, Host
│  ├─ Capability Catalog
│  ├─ Capability Controller
│  └─ Workbench Remote Gateway
│
├─ Workbench UI Shell                 required, Client
│  └─ Settings 状态、开关、重试和错误详情
│
└─ Reference Provider                 optional, Host
   └─ 独立 Cordis Fiber / 生命周期 / 故障注入
```

依赖方向固定为：

```text
Bundle -> Contracts
Core -> Contracts
UI -> Contracts + DSH Client public seams
Provider -> Contracts + Provider 自身底层依赖

Core -X-> Provider 私有实现
UI   -X-> Core 私有对象
Provider A -X-> Provider B
```

Bundle 把 Provider module specifier、版本和 manifest 作为数据交给 Core。Core 通过统一 Provider
Contract 加载插件，不静态调用具体 Provider API。Provider 以独立 Cordis child Fiber 运行；Core
只监督 Fiber 和状态，不接管 Provider 内部资源。

朴素 EntryGroup 对 child apply 失败执行整体回滚，与 Q-M2-01 冲突，因此 M2 不把 Optional
Provider 的启动成功作为 required Group apply 的共同事务。Recoverable Provider 失败必须被
Supervisor 隔离并转换成 Catalog 状态；只有 required Core 基础设施失败才允许 Workbench
启动失败。

## 4. 包结构、安装与版本策略

目标 Workspace 包结构：

```text
@dsh-embedded/dsh-embedded-workbench
@dsh-embedded/workbench-contracts
@dsh-embedded/workbench-core
@dsh-embedded/workbench-ui
@dsh-embedded/provider-reference
```

约束：

- 用户只执行一次 `dsh plugin add @dsh-embedded/dsh-embedded-workbench`；
- Bundle 对 Core、UI、Contracts 使用 required 精确版本；
- Bundle 对 Reference Provider 使用 Optional 精确版本；
- DSH prerelease peer dependency 锁定 `0.1.1-rc.2`，不得用 rc.1 证据替代；
- Provider manifest 声明 `provider_version` 和 `contract_version`；
- Supervisor 在执行 Provider 代码前完成 Contract major compatibility 校验；
- Provider 之间不得存在 package dependency、peer dependency 或运行时 import；
- 单插件 Settings 开关只控制运行，不等于独立升级 package；
- Bundle 升级和回滚以一组经过验证的兼容版本为单位。

Primary 分发策略使用 `optionalDependencies` 安装 Reference Provider，并在运行时捕获包缺失。
M2 必须先通过真实 `dsh plugin add/remove` 验证该策略。若验证失败，不得静默改为另一种分发
结构；应停止实现并将“Bundle 自带 Provider 产物、仍保持独立 Fiber”的 B2 方案写入 Spec
新版本，重新经过用户审查后再继续。

## 5. Capability Contract 与状态模型

### 5.1 状态维度

每个 Capability 使用四个正交维度，禁止用一个枚举混合不同事实：

| 维度 | 值 |
|---|---|
| 目标状态 | `desired_enabled: boolean` |
| 可用性 | `AVAILABLE / MISSING / INCOMPATIBLE / BLOCKED` |
| 运行阶段 | `STOPPED / STARTING / RUNNING / STOPPING / FAILED` |
| 应用方式 | `LIVE / RESTART_REQUIRED` |

Workbench 健康状态：

- `READY`：Core 正常，所有已启用能力均为 `AVAILABLE + RUNNING`；
- `DEGRADED`：Core 正常，但至少一个 Optional 能力不可用、失败或等待重启；
- `FAILED`：Contracts、Catalog、Settings、Controller 或 Remote 等 required 基础设施失败。

### 5.2 只读快照

Capability 快照至少包含：

```text
capability_id
display_name
provider_version
contract_version
required
desired_enabled
availability
phase
apply_mode
error
revision
updated_at
```

`error` 至少包含：

```text
code
stage
message
recoverable
suggested_action
occurred_at
```

快照必须是深复制或深冻结的 JSON-safe 数据，不得包含 Context、Fiber、Promise、disposer、
原始 Error、资源句柄或可变内部数组。

### 5.3 状态不变量

- 只有 `desired_enabled=true + AVAILABLE + RUNNING` 才显示“已启用”；
- `MISSING` 或 `INCOMPATIBLE` 时禁止执行 Provider 代码；
- `desired_enabled=false` 最终必须收敛到 `STOPPED`；
- `STARTING` 中收到禁用时不得进入幽灵 `RUNNING`；
- 清理不完整或资源残留未知时必须 `FAILED + RESTART_REQUIRED`；
- Optional Provider 的任何状态不得改写其他 Provider 的状态；
- Catalog 是状态投影，不拥有 Provider 资源，也不复制 Cordis 内部状态机。

## 6. Settings 与 Remote 控制平面

### 6.1 Settings 事实源

Host 注册 Settings namespace `dshEmbedded.workbench`，M2 只允许以下持久字段：

```text
capabilities.<capability_id>.enabled: boolean
```

Client 使用 `ctx.settingsScope.bind({ namespace: "dshEmbedded.workbench" })` 读取和写入；所有写入
携带最新 revision，发生冲突时不得覆盖 Host 较新值。Settings 为只读时，UI 禁用开关并显示
只读原因。

`desired_enabled` 以 Host Settings 为唯一事实源。UI 草稿、Remote 返回值和内存缓存都不是
新的持久状态源。

### 6.2 Typert Remote

Host 按官方 `TypertRemoteService` 模式注册 `workbenchCapabilities` namespace。M2 只暴露：

- `list()`：返回 Workbench 健康状态及所有 Capability 快照；
- `retry(capabilityId)`：重试一个 recoverable 的失败能力；
- `reconcile(capabilityId)`：只协调指定能力到当前 Settings 目标状态。

Remote 必须使用 Typert 生成的严格输入/输出 Schema，拒绝未知 Capability ID、未知字段和非法
类型。Remote 不直接提供新的配置存储接口，启用状态仍通过 Settings seam 持久化。

### 6.3 状态刷新

M2 不修改 `API_REMOTE_FORWARDED_EVENTS`，也不创建 WebSocket/EventEmitter 总线。UI 在以下时机
调用 `list()`：

1. Settings 页面打开；
2. Settings 写入完成；
3. `retry/reconcile` 完成；
4. Connection reconnect/reset；
5. 能力处于 `STARTING/STOPPING` 时进行有界轮询。

轮询只在瞬态阶段存在，进入稳定终态或 UI 卸载后必须清理 timer。通用实时推送留给 M5 在
公开 extension seam 上重新设计。

## 7. 启停、并发与资源所有权

### 7.1 启动流程

```text
Core 启动
-> 注册 Contracts / Settings / Catalog / Remote
-> 读取 Bundle Provider 描述符
-> 对每个 Provider 独立检查 package 和 Contract 版本
-> 对 enabled Provider 执行独立 reconcile
-> Promise.allSettled 汇总
-> READY 或 DEGRADED
```

禁止用 `Promise.all` 让一个 Optional Provider 拒绝整个启动链。

### 7.2 单能力 Operation Gate

- 每个 Capability 拥有独立 Operation Gate 和 in-flight Promise；
- 同一 Capability 的 start/stop/retry/reconcile 严格串行；
- 重复的同类操作复用 in-flight Promise；
- 快速切换以最新 `desired_enabled` 为最终目标，但不得跳过中间资源清理；
- 不同 Capability 不共享全局启停锁，可以独立推进；
- 启动中 disable 设置 stop request，并在安全点收敛到 `STOPPED`；
- 即时操作不能安全完成时保留真实实际状态并标记 `RESTART_REQUIRED`，不得伪造成功。

### 7.3 资源所有权

- Provider 创建并独占自己的 Fiber、资源栈和 disposer；
- Core 只能请求 Provider/Fiber 停止，不直接关闭 Provider 内部资源；
- Provider 获取一项资源后必须立即登记 disposer，并逆序清理；
- Core 卸载时对所有 Provider 发出停止请求并分别收集结果；一个清理失败不得跳过其他 Provider；
- M2 Reference Provider 继承 M1 的有界异步清理验证；真实硬件 Provider 的预算在其独立 Spec
  中按资源类型确定；
- Catalog 容量受已安装 Provider 数量约束，不允许无界状态历史；M2 只保留当前错误和有限诊断。

## 8. 失败、降级、通知与重试

Optional Provider 的恢复链固定为：

```text
启动失败
-> 保留启动根因
-> 逆序清理局部资源
-> 更新当前 Capability 为 FAILED
-> Workbench 更新为 DEGRADED
-> Settings 持续显示错误
-> 其他 Provider 不停止、不重启
```

错误至少区分 `discover/import/compatibility/start/stop/cleanup/settings/remote` 阶段，并使用稳定
错误码。UI 必须显示能力 ID、阶段、原因、期望/实际版本和建议处理动作。

M2 不进行循环自动重试。允许的触发只有：

- 用户点击单能力“重试”；
- Provider 包、版本或依赖状态变化后执行一次受控 reconcile；
- Workbench 下一次正常启动按 Settings 重新 reconcile。

已有操作进行中时重试复用当前 Promise。清理失败、资源残留未知或不可安全热切换时禁止原地
重试，并设置 `RESTART_REQUIRED`。

## 9. 配置和卸载数据生命周期

`dshEmbedded.workbench` Settings namespace 由 Workbench 拥有，Host Settings Provider 负责实际
文件持久化。UI 只借用投影，不拥有文件。

普通卸载：

- 停止全部 Provider Fiber；
- 注销 Core、Remote、Client slot 和 Settings UI；
- 移除 Bundle/package/row；
- 保留 `dshEmbedded.workbench` 用户设置，供重新安装恢复；
- 不保留 timer、Promise、进程、端口、资源句柄或运行态错误对象。

显式“重置工作台设置”：

- 必须由用户单独确认；
- 只清除 Workbench namespace；
- 不修改其他 DSH namespace；
- 执行后重新读取 Host Settings，不能只清理 Client cache。

隔离验证环境允许在测试结束后精确清除测试 namespace 和 `DSH_HOME`，但不得把该行为应用到
当前用户 Profile。

## 10. 验收测试清单

说明：V-M2-04、V-M2-15 中的 Provider A/B 与故障 fixture 是由 Reference Provider 构造的测试专用独立实例，用于证明兄弟能力隔离；它们不是新增的产品 Provider，也不进入正式发布组合。

| ID | 证据等级 | 验收项 | 通过条件 |
|---|---|---|---|
| V-M2-01 | 静态 | Workspace/package 边界 | Bundle/Core/UI/Contracts/Reference 职责和 exports 自洽 |
| V-M2-02 | 静态 | 依赖方向 | Provider 之间零依赖；Core/UI 不访问 Provider 私有实现 |
| V-M2-03 | 主机 | Contract 兼容 | compatible 可启动；major 不兼容不执行 Provider 代码 |
| V-M2-04 | 主机 | 启动失败隔离 | Provider A 失败，Core 与 Provider B 保持运行 |
| V-M2-05 | 主机 | 清理失败隔离 | A 清理失败仍继续清理 B；A 标记残留和 restart required |
| V-M2-06 | 主机 | 缺失 Provider | `MISSING + STOPPED`，Workbench 为 `DEGRADED` |
| V-M2-07 | 主机 | 并发和快速切换 | 无重复 Fiber/资源；最终收敛到最新 desired state |
| V-M2-08 | 主机 | 手动重试 | 单能力重试；无循环 timer、错误风暴或全局重启 |
| V-M2-09 | Settings | 持久化、冲突和重置 | restart 恢复 desired；revision 冲突不覆盖新值；只读可诊断；显式重置只清除 Workbench 命名空间 |
| V-M2-10 | Remote | Typert schema | `list/retry/reconcile` 严格校验，未知 ID/字段拒绝 |
| V-M2-11 | Client | 状态刷新 | 打开、写入、重试、重连和瞬态轮询后状态一致，timer 对称清理 |
| V-M2-12 | 打包 | 一次安装 | 一次 `dsh plugin add` 安装 required 组件并尝试 Optional Provider |
| V-M2-13 | 打包 | Optional 缺失 | Provider 安装缺失不阻止 Bundle/Core/UI 启动 |
| V-M2-14 | rc.2 runtime | 真实 Fiber 启停 | Settings 开关与 Reference Fiber 实际状态一致 |
| V-M2-15 | rc.2 runtime | 故障隔离 | 故障 fixture 不影响 Core/健康 fixture；状态持续可查 |
| V-M2-16 | UI 人工 | Settings 契约 | 开关、持续错误、重试、restart required 和只读状态可见 |
| V-M2-17 | 回滚 | 精确卸载 | 运行资源和产品入口消失，其他 Bundle/hash 不变，用户设置保留 |
| V-M2-18 | 静态/运行 | 零 Tool | Tool 集合增量为空；Reference Provider 不注册模型工具 |
| V-M2-19 | 资源 | 有界状态 | 无遗留 timer、unhandled rejection、悬挂 disposer 或无界错误历史 |
| V-M2-20 | 目标板/实物 | MCU/硬件 | `not_applicable`，不得外推硬件结论 |

真实隔离 rc.2 验收链必须完整记录：

```text
一次 plugin add
-> Bundle/Core/UI/Reference 可用
-> Settings 即时启停 Reference
-> desired 与 actual 分别可见
-> 故障 Provider 不影响健康 Provider
-> plugin remove 后运行资源和入口消失
-> 其他 Bundle/Profile 状态与安装前一致
-> Workbench Settings 按策略保留
```

## 11. 风险、门禁与未验证项

| ID | 状态 | 风险/未验证项 | 关闭条件 |
|---|---|---|---|
| R-M2-01 | `unverified` | `optionalDependencies` 与真实 `dsh plugin add/remove` 的失败和回滚语义 | V-M2-12/13/17；失败则回到 Spec v0.2，不静默换方案 |
| R-M2-02 | `unverified` | 当前 JS 工程接入 Typert generator 的最小构建方式 | 使用官方 generator 生成 Host/Remote descriptor，并通过 V-M2-10 |
| R-M2-03 | `confirmed-limitation` | Remote Event 没有第三方动态 allowlist seam | M2 采用查询/有界轮询；不得修改官方 allowlist |
| R-M2-04 | `open-version-risk` | DSH prerelease 后续漂移 | 锁定 rc.2；升级必须重新执行接口和运行矩阵 |
| R-M2-05 | `unverified` | Supervisor 捕获 child Fiber 启动失败后 Core 是否保持 active | Host fixture + 真实 rc.2 V-M2-04/15 |
| R-M2-06 | `unverified` | Settings namespace 卸载后保留及重装恢复行为 | V-M2-09/17 |
| R-M2-07 | `deferred` | 顶层 Workbench Loader live reload/disable-re-enable | 仍按 M1 决策延期，不以 M2 child Fiber 证据替代 |

代码阶段硬门禁：

1. 本 Spec 书面审查通过；
2. 生成并批准 M2 Plan；
3. Plan 明确 R-M2-01 和 R-M2-02 的先行验证顺序；
4. 未经上述门禁不得创建 Workspace 包、修改 manifest 或安装到任何 Profile。

## 12. 回滚边界

- 代码回滚锚点：`e9edbd8`；
- 只恢复 M2 修改或新增的 Workspace、Source、Test、Script 和 M2 文档状态，不回退 M0/M1；
- 运行验证只使用隔离 `DSH_HOME` 和官方精确 add/remove；
- 安装前后记录 dependency、bundle、row、client route、Remote namespace、Settings UI 和受保护
  Profile hash；
- 普通卸载保留 Workbench Settings；测试环境清理只删除明确解析后的隔离路径；
- 不使用进程重启掩盖 Provider disposer 失败；restart required 必须作为失败状态保留。

## 13. 证据边界与下一步

- 静态依赖检查不证明 package 安装；
- 主机 Fake/Fault Provider 不证明真实 Cordis Loader；
- rc.2 Loader 启停不证明浏览器 UI；
- UI 开关成功不证明任何嵌入式硬件能力；
- Reference Provider 不产生 Build/Flash/Serial/Debug 或目标板证据；
- M2 child Fiber 启停不等于顶层 Workbench Loader reload 已验证。

当前状态：M2 设计章节已由用户逐节确认，本书面 Spec 等待用户整体审查。用户批准书面 Spec 后，
下一步只能进入 `writing-plans` 生成 M2 实施计划；在 Plan 再次获批前不得修改产品代码。
