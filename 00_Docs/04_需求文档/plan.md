# DSH Embedded Workbench M0 集成实施计划

## 1. 元数据与状态

| 字段 | 内容 |
|---|---|
| request_id | `REQ-DSH-EW-M0-20260826` |
| 生成时间 | `2026-08-26T16:09:00+08:00` |
| 计划版本 | `v0.1` |
| 计划状态 | `approved-for-task-execution` |
| 项目路径 | `D:\zhuomian\dsh-embedded-workbench` |
| 分支/提交 | `main / unborn（无提交）` |
| 输入 spec.md | `D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\spec.md` |
| 输入 Review-Package | `D:\zhuomian\dsh-embedded-workbench\.mcu-workbench\workflows\REQ-DSH-EW-M0-20260826\state.json` |
| Spec 力度 | `full` |
| 风险叠加门禁 | `versioned` |
| 选定方案 | `方案 A：单包双入口最小基线` |
| 方案选择人 | `user` |
| 用户审查状态 | `approved（用户回复“A”）` |
| 方案审查结论 | `通过；无 Spec 变更` |

## 2. 一句话说明

- 要解决的问题：建立 DSH Embedded Workbench 的最小可加载基座，并以明确的 UI、日志和零工具证据证明注册成功。
- 计划做什么：用一个 npm package 同时提供 Cordis backend 入口和 web client 入口，通过一个 bundle patch 插入一个插件 row。
- 明确不做什么：不注册 Tool，不引入 Service/Driver、配置、事件、持久状态、命令执行、硬件、固件、发布或完整工作台 UI。
- 预期结果：Desktop bundled DSH `0.1.1-rc.1` 能加载该包；Settings 左侧显示“嵌入式开发工作台”；后端产生唯一加载标记；加载前后工具集合完全相同。

## 3. 输入依据与工程事实

| ID | 事实或约束 | 证据（文件/配置/命令） | 可信等级 | 对计划的影响 |
|---|---|---|---|---|
| E-01 | M0 的包名、显示名、零工具范围和非目标已批准 | `00_Docs/04_需求文档/spec.md:24-62` | `user-confirmed` | Plan 不得增加新能力或新权限 |
| E-02 | 仓库为 unborn `main`，目前只有 Spec/State 文档 | `git status --short --branch`、`rg --files` | `confirmed` | 所有实现文件均为新增；没有可用提交锚点 |
| E-03 | profile 用 `dependencies` 与 `dsh.profile.bundles` 组合 bundle | `%APPDATA%\dsh-desktop\harness\profiles\web\package.json` | `confirmed` | 安装和卸载必须同时核对 dependency 与 bundle 列表 |
| E-04 | DSH rc.1 的 `dsh plugin` 会执行 pnpm 后按包的 `dsh.bundle.patch` 自动协调 bundle 列表 | `F:\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\plugin-9h8shc4d.js:8-15,46-77,101-126` | `confirmed` | 隔离 profile 使用官方 plugin add/remove，不手工覆盖 manifest |
| E-05 | 单包同时提供 host 与 client 是已安装插件采用的真实结构 | `...\node_modules\dsh-context\package.json`、`dsh-strata\package.json` | `confirmed` | 方案 A 不需要提前拆 Host/UI 包 |
| E-06 | `settings.section` 的真实 client 依赖面是 runtime + UI settings；插件运行时注入名为 `slots` | `F:\DSH Desktop\...\dsh-client-ui-agent-preset\package.json`、`lib\client.js:1989-2002,2150-2157` | `confirmed` | M0 不依赖 connection、remote、locale 或不存在的产品服务 |
| E-07 | 当前 Desktop 后端运行 DSH rc.1；profile-local rc.2 `dump-config` 因依赖闭包损坏而失败 | `spec.md` F-06/F-12/F-13；`harness.log:1801-1816` | `confirmed` | 验收固定用 Desktop bundled Node/DSH rc.1；不得外推 rc.2 兼容 |
| E-08 | Settings、Loader、零工具和回滚验收已在 Spec 中分别定义 | `spec.md:175-183` | `user-confirmed` | Task 测试和最终 Verify 必须分层记录 |
| E-09 | 系统 Node、npm、pnpm 与 Desktop bundled Node 当前可用 | `node --version`=`v22.22.2`；`npm --version`=`10.9.7`；`pnpm --version`=`10.33.0`；Desktop Node=`v24.9.0` | `confirmed` | 包测试可用 Node 内建测试；真实运行固定 Desktop Node |

### 3.1 证据边界

- `confirmed`：包和 Loader 的结构先例、rc.1 CLI 行为、当前工具版本、批准的 M0 契约。
- `unverified`：新包的代码、安装、后端加载、client 路由、Settings UI 和工具集合差；这些只能在实施后关闭。
- `not_applicable`：FreeRTOS、ISR、DMA、MCU 内存、交叉编译、烧录、目标板和实物信号。
- profile-local rc.2 的失败是版本漂移证据，不是 M0 实施阻塞；M0 不修改或修复 rc.2 环境。

## 4. 两个候选方案与用户选择记录

### 方案 A：单包双入口最小基线

- 适用场景：M0 只有一个 Host 加载标记和一个 Settings 名称入口，尚无可独立替换的业务能力。
- 做什么：一个 package 导出 `.` 和 `./client`，一个 patch 插入一个 Cordis row。
- 主要改动：根 manifest、patch、`src/index.js`、`src/client.js`、包测试和只读验收脚本。
- 优点：调用链短、依赖面最小、测试矩阵小、安装和回滚目标唯一。
- 缺点：Host 与 UI 同版本发布；M3 出现真实可替换能力时可能需要拆分。
- 成本：低。
- 风险：client ID、patch name 或 package name 不一致会导致 Loader 无法解析；通过契约测试提前阻断。
- 验收方式：静态契约、Node 主机测试、隔离 rc.1 profile、真实 Loader、工具集合差、人工 UI。
- 回滚方式：在同一隔离 profile 执行官方 `dsh plugin remove`，精确比较受保护文件和 bundle 集合。

### 方案 B：Bundle + Host + UI 工作区拆包

- 适用场景：Host 与 UI 必须独立发布、独立替换或由不同团队维护。
- 做什么：根 Bundle 编排独立 Host/UI package 与多个 Cordis/client 注册节点。
- 主要改动：根 package 加 `packages/bundle`、`packages/host`、`packages/ui` 和跨包测试。
- 优点：包级边界更早独立，后续独立版本化更直接。
- 缺点：M0 没有真实能力 seam；依赖、row、测试和回滚步骤均增加。
- 成本：中高。
- 风险：过早抽象和多包装配失败面大于当前收益。
- 验收方式：除方案 A 验收外，还需验证多包版本、依赖、两个生命周期和联合回滚。
- 回滚方式：移除多个 row/package，再验证根 Bundle 与 profile 均恢复。

### 方案对比

| 维度 | 方案 A | 方案 B | 结论依据 |
|---|---|---|---|
| 易理解程度 | 低 | 中高 | A 只有一个包、一个 row、两个入口 |
| 改动范围 | 小 | 中大 | Spec 的 W-01..W-06 可直接映射 A |
| 实现复杂度 | 低 | 中高 | B 增加 workspace 与跨包依赖 |
| 运行时资源 | 一个 Host row + 一个 client module | 至少两个装配节点 | M0 没有拆分所需能力 |
| 架构风险 | 后续可能拆包，当前可控 | 当前过度设计风险 | M3 才首次出现真实 capability seam |
| 可验证性 | 高 | 中 | A 的故障定位和集合差边界更短 |
| 回滚难度 | 低 | 中高 | A 只移除一个包身份 |
| 后续扩展性 | 足够，按真实 seam 演进 | 独立演进能力更强 | 当前批准范围只到 M0 |

### 用户选择

```text
selected_option: A
decision_owner: user
decision_rationale: 用户回复“A”，未补充额外理由；不推断个人理由，实施依据沿用已展示的推荐理由和共同目标。
rejected_option: B
new_constraints: none
```

## 5. 选定方案概览

- 选定方案：A。
- 选定原因：在同一批准目标下，A 用最小运行时和最短验证链满足全部 M0 契约。
- 与 `spec.md` 的一致性：不改变包名、Settings 观察面、日志、零工具、rc.1 基线、回滚和非目标。
- 施工边界：仅根 package/patch、backend/client、`test/` 和 `scripts/verify-m0.ps1`。
- 非目标：不创建未来 Driver/Service/capability seam，不修复 rc.2，不修改官方 DSH、现有 mcu-workbench 或固件仓库。
- 主要风险：DSH prerelease 依赖漂移、client 注入契约误配、工具集合观察 API 未确认、隔离 profile 回滚不完整。

## 6. 分层、调用链与接口边界

M0 是 DSH 插件装配基座，不机械套用固件目录；其概念边界如下：

```text
DSH profile dependency/bundle
  -> cordis.patch.yml 的单一 row
    -> src/index.js：Host 加载标记
    -> dsh-client-modules 解析 package exports["./client"]
      -> src/client.js：ModuleLoader factory
        -> ctx.slots.inject("settings.section")
          -> Settings 左侧“嵌入式开发工作台”
```

- Package/Composition：只声明包身份、入口、client 注入依赖和一个 patch；不拥有业务状态。
- Host：导出稳定 `name` 和无状态 `apply`，只输出固定加载标记；不读取 `ctx.tools`，不注册服务。
- Client：只依赖 DSH client runtime 提供的 React 共享模块及 `slots` seam；注册一个 Settings section。
- Verification：测试可观察 Host/Client 和工具注册表，但测试观察器不得进入产品 exports、bundle 或发布文件。
- 允许依赖：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-settings` 的 rc.1 兼容范围。
- 禁止依赖：`@deepseek-ai/dsh-tools`、现有 `@mcu-workbench/dsh-tools`、connection/remote、文件/进程/串口/网络/硬件服务。
- 输入/输出与所有权：Host 无输入输出资源；Settings 元数据和 React 节点由 client 创建，由 Cordis client fiber/slot 注册器拥有并在卸载时释放。
- 阻塞与并发：Host/Client `apply` 不阻塞、不启动异步工作、不创建定时器；不声明线程安全或可重入的业务保证，因为 M0 无共享业务状态。

### 6.1 SOLID 硬门禁映射

| 原则 | 方案 A 的满足方式 | 可验证证据 | 阻塞条件 |
|---|---|---|---|
| SRP | manifest、composition、Host、Client、verification 各有单一变化原因 | 文件职责测试与 diff | 任一实现同时引入业务或硬件职责 |
| OCP | 只通过自己的 bundle row/client slot 扩展，不修改官方 core | 官方目录无 diff；patch 仅 insert | 需要修改官方 DSH 才能加载 |
| LSP | 遵守 Cordis plugin/client 生命周期；slot 注册可对称清理 | Fake lifecycle test + 卸载后 UI 消失 | client 注册无法释放或留下全局副作用 |
| ISP | M0 只声明实际使用的 runtime/settings seam | manifest 依赖检查；无 connection/tools | 为未来功能预装大接口 |
| DIP | Client 依赖 `slots` 抽象，不依赖具体 Settings 实现或现有 mcu 包 | import/require/manifest 扫描 | Consumer 直接依赖具体 Provider |

## 7. 文件施工顺序

| ID | 阶段 | 动作 | 文件或目录 | 所属层 | 施工内容与理由 | 责任 Skill | 前置条件 | 生成/覆盖边界 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| P-01 | 1 | 新增 | `package.json` | Package | 固化 package ID、ESM exports、测试脚本、bundle/client 声明和最小 peer dependencies | `mcu-workbench:workflow-ai-collab` | approved Spec/Plan | 不生成 lock；不声明发布配置和未来依赖 | `ready` |
| P-02 | 1 | 新增 | `cordis.patch.yml` | Composition | 仅 insert `dsh-embedded-workbench` row，name 精确等于 package ID | `mcu-workbench:workflow-ai-collab` | P-01 | 不覆盖完整配置，不带 config/权限 | `ready` |
| P-03 | 2 | 新增 | `src/index.js` | Host | 导出最小 `name/apply`，输出 `[dsh-embedded-workbench] M0 loaded` | `mcu-workbench:workflow-ai-collab` | P-01/P-02 | 无工具、服务、I/O、异步和持久状态 | `ready` |
| P-04 | 3 | 新增 | `src/client.js` | Client | 注册唯一 Settings section；label 精确为“嵌入式开发工作台”；生命周期对称 | `mcu-workbench:workflow-ai-collab` | P-01/P-02 | 不实现完整工作台页面，不连接 Host API | `ready` |
| P-05 | 4 | 新增 | `test/package-contract.test.js`、`test/backend.test.js`、`test/client.test.js` | Verification | 先写失败测试，再实现契约、无 tools 访问、ModuleLoader ID 和 slot cleanup 回归 | `mcu-workbench:tdd` | P-01..P-04 的预期契约 | 测试观察器不得被产品导出 | `ready` |
| P-06 | 4 | 新增 | `test/runtime/` | Verification | 存放测试期工具集合观察器/fixture；执行前先确认 rc.1 的只读注册表 API | `mcu-workbench:tdd` | P-05 | 若无只读 API，停止并回传，不用静态扫描替代集合差 | `ready-with-guard` |
| P-07 | 5 | 新增 | `scripts/verify-m0.ps1` | Tooling | 只读校验包、指定 profile、HTTP 路由、日志标记和两份工具快照集合差 | `mcu-workbench:tools-verification` | P-05/P-06 | 脚本不得安装、删除或修改 profile | `ready` |
| P-08 | 6 | 外部装配 | 隔离 `$DSH_HOME\profiles\web` | Runtime fixture | 用 Desktop rc.1 官方 plugin add/remove 完成安装、启动、回滚证据 | `mcu-workbench:workflow-ai-collab` | P-01..P-07 全部测试通过 | 只允许写隔离 DSH_HOME；禁止当前用户 profile | `ready` |
| P-09 | 7 | 不修改 | `%APPDATA%\dsh-desktop\harness\profiles\web`、`D:\zhuomian\embedded_framework` | Protected | 明确保持无 diff | `mcu-workbench:tools-verification` | 全阶段 | 禁止写入 | `locked` |

## 8. 阶段计划与交接

| 阶段 | 目标 | 输入 | 输出 | 完成条件 | 交接对象 |
|---|---|---|---|---|---|
| 1. 包与组合契约 | 建立单包、双入口、单 row 骨架 | Spec、rc.1 package/CLI 证据 | manifest、patch | 静态契约测试通过 | Host/Client 实现 |
| 2. Host | 产生无状态加载标记 | package/patch | `src/index.js` | Proxy ctx 证明不访问 tools/服务 | Client 实现 |
| 3. Client | 建立最小 Settings 名称入口 | Loader/slot 证据 | `src/client.js` | ModuleLoader、label、register/cleanup 测试通过 | Verification |
| 4. 包级验证 | 关闭静态和主机测试 | 实现文件 | Node test 结果、工具观察 fixture | Task 级测试全部通过 | Runtime 装配 |
| 5. 隔离 rc.1 装配 | 证明官方 add/remove、Loader 和回滚 | Desktop Node/DSH、隔离 DSH_HOME | profile 快照、日志、HTTP、工具集合差 | V-M0-05/06/07/09 通过 | UI 验收 |
| 6. UI 验收 | 证明用户可见名称 | 运行中的隔离 rc.1 Web | UI 检查记录 | 刷新/重启后名称可见、可点击、控制台无错 | 最终 Verify |
| 7. 最终 Verify | 按批准 Spec 统一验收 | 全部 Task 证据 | V-M0-01..09 总结 | 无偏差；M0-08 明确 N/A | `workflow-final-review` |

## 8A. 下游执行 Agent 与 Skill 基线

每项任务只能由一个主实现 Skill 修改代码；辅助 Skill 只提供约束或审查，不并行修改同一文件。

| 阶段/ID | 主 Agent | 协作 Agent | 主实现 Skill | 辅助 Skill | 分配理由与证据 | 状态 |
|---|---|---|---|---|---|---|
| P-01/P-02 | toolchain-engineer | system-architect | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:tools-quality` | 包、patch 与官方 rc.1 plugin reconcile 直接相关 | `ready` |
| P-03 | embedded-lead | system-architect | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:tdd` | 无状态 Host 入口；当前注册集合没有独立 firmware-engineer，由 embedded-lead 承担唯一实现责任 | `ready` |
| P-04 | embedded-lead | system-architect | `mcu-workbench:workflow-ai-collab` | `mcu-workbench:frontend-excellence` | 唯一 UI 入口；当前注册集合没有独立 frontend owner，由 embedded-lead 承担唯一实现责任 | `ready` |
| P-05/P-06 | verification-engineer | toolchain-engineer | `mcu-workbench:tdd` | `mcu-workbench:tools-verification` | 先失败测试、再用三层零工具证据关闭 | `ready` |
| P-07/P-08/P-09 | toolchain-engineer | verification-engineer | `mcu-workbench:tools-verification` | `mcu-workbench:tools-quality` | 需要隔离 profile、可复现命令和精确回滚 | `ready` |

唯一主代码实现 Skill：`mcu-workbench:workflow-ai-collab`。测试和运行验证分别由 TDD/Verification Skill 接管，不扩大产品范围。

## 9. 资源、并发与生命周期约束

- 任务、优先级、栈和周期：M0 不创建 RTOS/Node 后台任务，不存在周期调度或任务栈配置。
- 队列、通知、信号量和互斥量：不适用；禁止为未来能力预建。
- ISR、DMA、Cache、对齐：不适用；不得据此声称任何硬件证据。
- 内存：不显式分配堆缓冲区，不维护缓存；React 元素和 slot 元数据由 client runtime 生命周期管理。
- 初始化：profile 解析 package/patch，Host `apply` 输出加载标记，Client Loader 注册 section。
- 释放：client fiber 卸载时注销 section；Host 无需释放资源。
- 错误：import/patch/Loader 失败直接保留非零退出或明确错误日志，不捕获后吞掉。
- 超时/重试/降级：M0 不自动重试；运行验收超时只记为失败，不能降级为“已加载”。

## 10. 代码生成约束

| ID | 约束类别 | 必须遵守 | 禁止事项 | 证据 | 状态 |
|---|---|---|---|---|---|
| G-01 | Identity | package、patch name、ModuleLoader ID 精确为 `@dsh-embedded/dsh-embedded-workbench` | 别名或复用 mcu package ID | Spec M0、contract test | `ready` |
| G-02 | Host | 仅 `name/apply` 与固定日志标记 | `inject=["tools"]`、注册 API、I/O、状态 | Spec G-01/G-05 | `ready` |
| G-03 | Client | 仅注入 `slots`，注册一个 `settings.section` | connection/remote、完整面板、全局 listener | Spec F-14/G-03/G-04 | `ready` |
| G-04 | Composition | patch 只使用一个 `insert` | update/remove 其他 row、整树覆盖 | Spec G-02 | `ready` |
| G-05 | Dependencies | 只含 rc.1 所需 Cordis/client runtime/UI settings peer | `dsh-tools`、mcu 私有实现、未来能力依赖 | rc.1 官方 package 证据 | `ready` |
| G-06 | Verification | 测试观察器只能在 `test/runtime` | 将观察器写入 exports、bundle 或 files | Spec V-M0-09 | `ready` |
| G-07 | External state | 运行态测试只写隔离 DSH_HOME | 修改当前 profile、官方 runtime、固件工程 | Spec W-07/W-08 | `ready` |
| G-08 | Evidence | 静态、主机、Loader、UI、运行态、N/A 分开记录 | 低等级证据替代 UI/运行态结论 | Spec 验收表 | `ready` |

## 11. 验收与验证计划

### 11.1 Task 级测试

| ID | 证据等级 | 验收项 | 命令/条件 | 预期结果 | 责任 Skill | 产物 | 状态 |
|---|---|---|---|---|---|---|---|
| V-01 | 静态 | JS 语法 | `node --check src/index.js`、`node --check src/client.js` | 退出码 0 | `tools-quality` | 命令输出 | `not-run` |
| V-02 | 主机 | package/patch/Host/Client 契约 | `npm test`（内部使用 `node --test test/*.test.js`） | 全部测试通过 | `tdd` | TAP 输出 | `not-run` |
| V-03 | 静态 | 无 Tool 或越界依赖 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-m0.ps1` | forbidden count=0 | `tools-verification` | JSON/控制台摘要 | `not-run` |
| V-04 | 包产物 | npm 包内容边界 | `npm pack --dry-run --json` | 只包含批准的 package/patch/src 文件 | `tools-quality` | pack JSON | `not-run` |

### 11.2 隔离 rc.1 运行验收

统一环境变量（执行时为每次 run 生成唯一、已解析的绝对路径）：

```powershell
$M0DshHome = 'D:\zhuomian\dsh-embedded-workbench\.mcu-workbench\runtime\<run-id>\dsh-home'
$DesktopNode = 'F:\DSH Desktop\resources\app\node_modules\node\bin\node.exe'
$DshBin = 'F:\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js'
$env:DSH_HOME = $M0DshHome
```

| ID | 证据等级 | 验收项 | 命令/条件 | 预期结果 | 责任 Skill | 产物 | 状态 |
|---|---|---|---|---|---|---|---|
| V-05 | 配置装配 | 官方 rc.1 初始化并安装本地包 | `& $DesktopNode $DshBin plugin --profile web add 'file:D:/zhuomian/dsh-embedded-workbench'` | 退出码 0；dependency/bundle/row 各新增一个 | `tools-verification` | 安装前后 manifest/lock/bundle 快照和 SHA-256 | `not-run` |
| V-06 | 配置装配 | rc.1 composed config | `& $DesktopNode $DshBin --profile web --dump-config` | 退出码 0；目标 row 唯一；无目标错误 | `tools-verification` | dump 与退出码 | `not-run` |
| V-07 | 后端/Loader | 启动隔离 Web | `& $DesktopNode $DshBin web --no-open --host 127.0.0.1 --port <free-port>` | 日志含唯一 M0 marker；目标 client 路由 HTTP 200 | `tools-verification` | PID、端口、日志、HTTP 状态/哈希 | `not-run` |
| V-08 | 运行态 | 工具集合零增量 | 同一 rc.1 profile/preset，分别在未加载和加载目标 row 时由测试观察器输出排序后的工具名；执行 exact set diff | added=[] 且 removed=[]；观察器不在产品 bundle | `tdd` + `tools-verification` | baseline/candidate JSON 与 diff | `not-run` |
| V-09 | UI 人工 | Settings 名称入口 | 打开隔离 Web；Settings 左侧检查；点击、刷新并重启复查 | 精确显示“嵌入式开发工作台”，可渲染，控制台无目标错误 | user + verification-engineer | 检查记录/截图（如可用） | `not-run` |
| V-10 | 回滚 | 精确卸载本包 | `& $DesktopNode $DshBin plugin --profile web remove '@dsh-embedded/dsh-embedded-workbench'` | 目标 dependency/bundle/row/client/UI 消失；其他 bundle 集合及受保护文件哈希恢复 | `tools-verification` | 回滚后快照、404/UI 消失记录 | `not-run` |
| V-11 | 目标板/实物 | 硬件验证 | M0 不适用 | 明确记录 `not_applicable` | hardware-integration | N/A 记录 | `not_applicable` |

工具集合观察 API 当前仍是 `unverified`。P-06 必须先针对 rc.1 确认 `ctx.tools.schemas()`、`knownNames` 或等价只读入口；若不存在，状态改为阻塞并回传本 Plan，不能以源码扫描替代 V-08。

### 11.3 最终 Verify

全部 Task 测试通过后才统一执行最终 Verify：逐项对照批准的 `spec.md` V-M0-01..09，复核产物、日志、快照、集合差和 UI 记录。若发现需求、范围或验收偏差，必须回到 Review Gate 更新 Spec 并重新生成 Plan/Task；不得在 Verify 阶段直接修补后放行。

## 12. 方案审查记录

本轮尝试调度 `system-architect`、`toolchain-engineer`、`verification-engineer` 复审，但三个代理均因当前协作额度限制未返回新结论。按用户“继续”的指示，由 `embedded-lead` 使用已确认的历史审查证据和当前工作区重新完成本地代审；不把失败的代理调用记作已完成审查。

| 审查项 | 责任 Agent | 结论 | 证据 | 修订或后续动作 |
|---|---|---|---|---|
| 分层和接口 | `system-architect（embedded-lead 本地代审）` | `可采用` | 单包双入口先例；M0 无 capability seam；第 6/6.1 节 | Client 依赖改按真实 `runtime + ui-settings -> slots` 契约描述 |
| 文件和数据流 | `firmware-engineer（embedded-lead）` | `可采用` | Spec W-01..W-06 与 P-01..P-07 一一映射 | 固件、RTOS、硬件均锁定为 N/A |
| 验收和回归 | `verification-engineer（embedded-lead 本地代审）` | `可采用，带执行守卫` | Spec V-M0-01..09；第 11 节 | 工具只读 API 未确认时必须阻塞，不允许降级 |
| 硬件边界 | `hardware-integration` | `不适用` | Spec V-M0-08 | 不产生目标板/实物声明 |
| 工具链和产物 | `toolchain-engineer（embedded-lead 本地代审）` | `可采用` | rc.1 CLI help；plugin reconcile 源码；当前 Node/pnpm 版本 | 只写隔离 DSH_HOME；rc.2 明确排除 |

### 审查结论

- 可采用项：单 package、单 Cordis row、Host/Client 双入口、Node 内建测试、隔离 rc.1 profile、官方 add/remove、分级验收。
- 已完成修订：client 依赖面由旧先例中的 `ui-slots/connection` 收敛为当前官方证据支持的 `runtime + ui-settings`；明确工具集合观察 API 的执行守卫；回滚增加受保护文件哈希和集合比较。
- 未关闭阻塞：none。工具观察 API 是实施前置检查，不改变批准标准；若检查失败才转为运行时阻塞。
- 是否改变 `spec.md`：否。
- 最终结论：通过。

## 13. 回滚与失败处理

- 代码或配置回滚：仓库尚无 HEAD，不能依赖 `git revert`；实施前记录 `git status --short --branch` 和文件清单。新增文件可按 Task 精确回退，但不得删除 Spec/Plan/State 或用户文件。
- 隔离 profile 回滚：只在已解析且位于 `D:\zhuomian\dsh-embedded-workbench\.mcu-workbench\runtime\<run-id>` 下的目标执行官方 plugin remove；不得操作 `%APPDATA%` 当前 profile。
- 中途失败：保留隔离 profile、日志、快照和退出码供 Final Review；不自动清理证据目录。
- 定位顺序：package/patch -> pnpm install -> composed config -> Host marker -> client HTTP -> ModuleLoader -> Settings slot -> 工具集合差 -> remove/回滚。
- 不可恢复或需回传：发现必须修改官方 DSH、当前用户 profile、Spec 验收标准、包身份或引入新权限；立即停止并回到 Review Gate。

## 14. 下游交接

- 正式需求/约束输入：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\spec.md`
- 正式实施计划：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\plan.md`
- 阶段级 Agent/Skill 基线：本文件第 8A 节。
- 目标文件范围：`package.json`、`cordis.patch.yml`、`src/index.js`、`src/client.js`、`test/**`、`scripts/verify-m0.ps1`。
- 执行前必须确认：当前工作树、Desktop Node/DSH rc.1 路径、pnpm、隔离 DSH_HOME 绝对路径、工具注册表只读观察入口。
- 禁止扩大：不得修改当前 profile、官方 runtime、mcu-workbench、embedded_framework；不得加入 M1+ 能力。
- 格式与注释规则来源：当前项目 AGENTS.md 用户约束、现有 DSH ESM/client bundle 风格；M0 无 C/C++ 注释需求。
- 可复现质量命令：`node --check`、`npm test`、`npm pack --dry-run --json`、`scripts/verify-m0.ps1`。
- 初始及允许整改范围：仅上述目标文件；Final Review 不得改 Spec/Plan/State、外部 profile 或官方包。
- 预期验证层级：静态、主机、配置装配、后端/Loader、运行态工具集合、UI 人工；目标板/实物 N/A。
- 实现完成后交接：`workflow-final-review`。
- 回传规则：新事实改变范围、接口、权限、资源或验收时回到 `workflow-review-gate`；仅任务粒度问题回到 `workflow-task-breakdown`。

## 15. 当前状态与下一步

- 当前状态：`approved`。
- 当前唯一动作：交给 `workflow-task-breakdown` 生成有序、单一责任且可独立验证的 `task.md`。
- 阻塞项：none。
