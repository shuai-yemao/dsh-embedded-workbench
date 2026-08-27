# DSH Embedded Workbench M0 实施任务清单

> 本文件只拆解已批准的 `spec.md` 与 `plan.md`，不新增需求。每项 Task 必须先建立失败检查，再完成局部实现与验证；Task 通过不等于 M0 最终 Verify 通过。

## 1. 元数据

| 字段 | 内容 |
|---|---|
| request_id | `REQ-DSH-EW-M0-20260826` |
| 任务清单版本 | `v0.1` |
| 状态 | `可交付` |
| 项目路径与提交 | `D:\zhuomian\dsh-embedded-workbench @ main/unborn` |
| 输入 spec.md | `D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\spec.md` |
| 输入 plan.md | `D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\plan.md` |
| Spec 力度 | `full` |
| 风险叠加门禁 | `versioned` |
| 生成时间 | `2026-08-26T16:09:00+08:00` |
| 阶段级 Agent/Skill 基线 | `plan.md` 第 8A 节 |
| 下游执行 Skill | `workflow-task-execution` |

可信等级：`confirmed`、`user-confirmed`、`inferred`、`unverified`。本清单没有影响范围或顺序的未关闭 `unverified` 事实。

## 2. 总体任务图

```text
T-001
  ├─> T-002 ─┐
  └─> T-003 ─┴─> T-004 ─> T-005 ─> T-006 ─> T-007 ─> T-008 ─> T-009
```

- 总体目标：交付单包双入口 M0，并形成包级、Host、Client、Loader、工具集合、UI 和回滚证据。
- 非目标：所有 M1+ 能力、当前用户 profile、官方 DSH、mcu-workbench、embedded_framework、硬件与发布。
- 关键串行链：`T-001 → T-002/T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009`。
- 可并行任务组：`G-01={T-002,T-003}`，两者分别拥有 Host 与 Client 文件；下游执行仍一次只修改一个任务范围。
- 不可并行原因：T-004 以后共享完整包、隔离 profile、端口、日志和工具快照，必须串行。

## 3. 任务索引

| 顺序 | task_id | 任务名称 | 前置任务 | 并行组 | 主 Agent | 主实现 Skill | 辅助 Skill | 验证等级 | 状态 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | T-001 | 建立包与单 row 组合契约 | none | none | toolchain-engineer | `mcu-workbench:workflow-ai-collab` | `tools-quality`,`tdd` | static/host | `pass` |
| 2 | T-002 | 实现零能力 Host 加载入口 | T-001 | G-01 | embedded-lead | `mcu-workbench:workflow-ai-collab` | `tdd` | host | `pass` |
| 3 | T-003 | 实现 Settings 名称入口和清理 | T-001 | G-01 | embedded-lead | `mcu-workbench:workflow-ai-collab` | `frontend-excellence`,`tdd` | host | `pass` |
| 4 | T-004 | 建立统一只读 M0 验证出口 | T-002,T-003 | none | verification-engineer | `mcu-workbench:tdd` | `tools-verification`,`tools-quality` | static/host/build | `pass` |
| 5 | T-005 | 建立测试期工具集合观察器 | T-004 | none | verification-engineer | `mcu-workbench:tdd` | `tools-verification` | host | `pass` |
| 6 | T-006 | 完成隔离 rc.1 安装与 Loader 验证 | T-005 | none | toolchain-engineer | `mcu-workbench:tools-verification` | `workflow-ai-collab` | target | `pass` |
| 7 | T-007 | 证明运行态工具集合零增量 | T-006 | none | verification-engineer | `mcu-workbench:tools-verification` | `tdd` | target | `pass` |
| 8 | T-008 | 完成 Settings UI 人工验收 | T-007 | none | verification-engineer | `mcu-workbench:tools-verification` | `frontend-excellence` | target | `pass` |
| 9 | T-009 | 精确卸载并证明环境回滚 | T-008 | none | toolchain-engineer | `mcu-workbench:tools-verification` | `tools-quality` | target | `pass` |

## 4. 任务详情

### T-001：建立包与单 row 组合契约

| 字段 | 内容 |
|---|---|
| order | `1` |
| parallel_group | `none` |
| source_plan_ids | `P-01,P-02,G-01,G-04,G-05` |
| source_spec_ids | `W-01,W-02,G-02,G-03,V-M0-01` |
| owner_agent | `toolchain-engineer` |
| support_agents | `system-architect,verification-engineer` |
| owner_skill | `mcu-workbench:workflow-ai-collab` |
| supporting_skills | `mcu-workbench:tools-quality,mcu-workbench:tdd` |
| allocation_evidence | rc.1 `plugin-9h8shc4d.js` 会从 dependency 的 `dsh.bundle.patch` 协调 bundle；Plan 第 7/8A 节 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

`package.json` 与 `cordis.patch.yml` 形成可由 DSH 解析的唯一 package/row/client 身份，且没有未来能力依赖。

#### 范围

- 包含：`package.json`、`cordis.patch.yml`、`test/package-contract.test.js`。
- 不包含：Host/Client 行为、安装、发布和 lockfile。
- 所属层：Package/Composition internal role。

#### 前置条件与依赖

- 前置任务：none。
- 外部前提：包名和显示契约已由 Spec 批准；rc.1 package/patch 机制已静态确认。
- 依赖证据：`spec.md` F-05/F-07/F-14；`plan.md` E-03..E-06。

#### 执行步骤

1. 先建立失败测试，断言 package ID、ESM、`.`/`./client` exports、patch 路径和单 row。
2. 新增 manifest；client inject 仅含 rc.1 所需 runtime 与 UI settings；禁止 dsh-tools/mcu 私有依赖。
3. 新增只含一个 `insert` 的 patch，row id 为 `dsh-embedded-workbench`，name 等于 package ID。
4. 运行局部测试并审查新增文件范围。

#### 输出物

- 文件：`package.json`、`cordis.patch.yml`、`test/package-contract.test.js`。
- 接口：package exports 与 DSH bundle/client manifest。
- 中间产物：`T-001-test.log`。

#### 约束边界

- SRP/ISP/OCP：manifest 与 patch 只负责装配；不得加入 connection、tools、remote、硬件或发布依赖。
- 生命周期：无运行时资源。
- 并发、ISR、DMA、内存：不适用。
- 生成边界：手写 ESM/YAML；不得覆盖 profile 配置。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host` |
| 命令或条件 | `cwd=D:\zhuomian\dsh-embedded-workbench; node --test test/package-contract.test.js` |
| 预期结果 | 退出码 0；一个 package、一个 row、两个 exports；禁用依赖命中数 0 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-001/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 定位顺序：JSON -> exports -> dsh fields -> YAML -> identity 一致性。
- 重试/降级：只修复当前三个文件，不降级契约。
- 回滚：精确移除 T-001 新增文件；保留 Spec/Plan/State。
- 回传条件：rc.1 必须采用不同 package/patch 契约时回到 Integration Plan。

#### 执行结果

- allocation_id：`T-001-20260826T163420+0800`。
- 测试先行：首次因 `package.json`/patch 不存在而 0/2；审查补强后因
  DSH peer 使用宽范围而 1/2，均为预期失败。
- 实现：新增单包 manifest、单 row patch，并把两个 DSH client peer 精确
  锁定为 `0.1.1-rc.1`。
- 实现后：direct 与 npm test 均 2/2，`git diff --check` 退出码 0。
- AI 审查：system-architect 复核通过；verification-engineer 的证据完整性
  意见已通过日志、精确断言和执行记录关闭。
- solid_status：`pass`；SRP/OCP/ISP/DIP=`pass`，LSP=`not_applicable`。
- 证据：`.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/`
  `20260826T163420+0800/T-001/`。

### T-002：实现零能力 Host 加载入口

| 字段 | 内容 |
|---|---|
| order | `2` |
| parallel_group | `G-01` |
| source_plan_ids | `P-03,G-02` |
| source_spec_ids | `W-03,G-01,G-05,V-M0-02,V-M0-03` |
| owner_agent | `embedded-lead` |
| support_agents | `system-architect,verification-engineer` |
| owner_skill | `mcu-workbench:workflow-ai-collab` |
| supporting_skills | `mcu-workbench:tdd` |
| allocation_evidence | Plan 第 6 节 Host 边界；Spec 明确 Host 只加载并留日志 |
| confidence | `user-confirmed` |
| status | `pass` |

#### 目标

Host 导出最小 `name/apply`，加载时输出唯一 marker，且不读取或注册任何 Tool/Service。

#### 范围

- 包含：`src/index.js`、`test/backend.test.js`。
- 不包含：Client、配置、异步、I/O、状态和错误包装体系。
- 所属层：Host internal role。

#### 前置条件与依赖

- 前置任务：T-001。
- 外部前提：Node ESM 可直接导入 root export。
- 依赖证据：`dsh-strata/index.js` 的无状态 Host 先例；Spec G-01/G-05。

#### 执行步骤

1. 用 Proxy ctx 写失败测试：访问任意属性立即报错；捕获 console marker。
2. 实现 `name` 和同步、无状态 `apply`。
3. marker 固定为 `[dsh-embedded-workbench] M0 loaded`；不吞 import/apply 错误。
4. 执行局部测试和 `node --check`。

#### 输出物

- 文件：`src/index.js`、`test/backend.test.js`。
- 符号：`name`、`apply`。
- 中间产物：Host 测试日志。

#### 约束边界

- SRP/ISP：只标记加载；不得导出 Tool/Service 或 `inject=["tools"]`。
- 资源/生命周期：无持有资源、无 disposer。
- 并发、ISR、DMA：不适用；不得启动 Promise、timer 或 worker。
- 内存：无缓存、队列或显式缓冲。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | `cwd=D:\zhuomian\dsh-embedded-workbench; node --test test/backend.test.js; node --check src/index.js` |
| 预期结果 | 不访问 Proxy ctx；marker 恰好一次；退出码 0 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-002/` |
| 当前状态 | `not-run` |

#### 失败处理与回滚

- 定位顺序：ESM export -> apply 调用 -> ctx 访问 -> marker 次数。
- 重试/降级：不得删除日志验收或改成静默成功。
- 回滚：只回退 T-002 两个文件。
- 回传条件：需要 Host 服务或异步生命周期时回到 Review Gate。

#### 执行结果

- allocation_id：`T-002-20260826T165100+0800`。
- 测试先行：`src/index.js` 缺失，backend test 因
  `ERR_MODULE_NOT_FOUND` 失败（exit 1，0/1）。
- 实现：同步、无状态 `name/apply`，只输出批准的唯一 marker。
- 实现后：backend 1/1、全套 3/3、`node --check` 与行尾空白检查通过。
- AI 审查：system-architect 复核通过，无修订项。
- solid_status：`pass`；SRP/OCP/ISP/DIP=`pass`，LSP=`not_applicable`。
- 未验证：真实 Loader 日志属于 T-006。

### T-003：实现 Settings 名称入口和清理

| 字段 | 内容 |
|---|---|
| order | `3` |
| parallel_group | `G-01` |
| source_plan_ids | `P-04,G-03` |
| source_spec_ids | `W-04,G-03,G-04,V-M0-03,V-M0-04` |
| owner_agent | `embedded-lead` |
| support_agents | `system-architect,verification-engineer` |
| owner_skill | `mcu-workbench:workflow-ai-collab` |
| supporting_skills | `mcu-workbench:frontend-excellence,mcu-workbench:tdd` |
| allocation_evidence | 官方 rc.1 settings client 以 `inject=["slots"]` 和 `ctx.slots.inject/register` 注册 section |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

Client bundle 通过精确 ModuleLoader ID 注册一个可清理的 `settings.section`，显示批准名称。

#### 范围

- 包含：`src/client.js`、`test/client.test.js`。
- 不包含：完整工作台、网络/Host RPC、locale、主题、持久状态。
- 所属层：Client/Consumer internal role。

#### 前置条件与依赖

- 前置任务：T-001。
- 外部前提：runtime 提供 React/JSX shared module，UI settings 声明 `settings.section`。
- 依赖证据：`dsh-client-ui-agent-preset/package.json` 与 `lib/client.js:1989-2002,2150-2157`。

#### 执行步骤

1. 用 VM/Fake ModuleLoader 与 Fake slots 建立失败测试，捕获 ID、factory exports、section metadata 和 disposer。
2. 实现 `window.__ModuleLoader__.load`；ID 精确等于 package ID。
3. Client exports 仅声明 `name`、`inject=["slots"]`、`apply`。
4. 注册唯一 section：id=`dsh-embedded-workbench`，label=`嵌入式开发工作台`，内容为最小静态说明。
5. 验证卸载清理、不产生全局 listener/timer/state。

#### 输出物

- 文件：`src/client.js`、`test/client.test.js`。
- 接口：ModuleLoader factory、Settings section registration。
- 中间产物：Client lifecycle 测试日志。

#### 约束边界

- DIP/LSP：只消费 slots seam，注册/清理对称；不得 import 具体 Settings Provider。
- 资源：React 节点和 slot 元数据由 client fiber 所有。
- 并发、ISR、DMA：不适用；无异步回调。
- 内存：无缓存；不保存临时 props 或外部句柄。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | `cwd=D:\zhuomian\dsh-embedded-workbench; node --test test/client.test.js; node --check src/client.js` |
| 预期结果 | Loader/section ID 正确；label 精确；register/cleanup 各一次；无越界依赖 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-003/` |
| 当前状态 | `pass` |

#### 失败处理与回滚

- 定位顺序：ModuleLoader -> factory require -> inject -> slots.inject -> register/disposer。
- 重试/降级：不得降级成 inventory 名称或只保留 Host 日志。
- 回滚：只回退 T-003 两个文件。
- 回传条件：需要 connection/remote 或新 UI 契约时回到 Review Gate。

### T-004：建立统一只读 M0 验证出口

| 字段 | 内容 |
|---|---|
| order | `4` |
| parallel_group | `none` |
| source_plan_ids | `P-05,P-07,V-01..V-04` |
| source_spec_ids | `W-05,W-06,V-M0-01..V-M0-03` |
| owner_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| owner_skill | `mcu-workbench:tdd` |
| supporting_skills | `mcu-workbench:tools-verification,mcu-workbench:tools-quality` |
| allocation_evidence | Spec 要求静态、Proxy 主机、零工具扫描分开；Plan 第 11.1 节 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

`npm test` 与 `scripts/verify-m0.ps1` 能只读复核完整包契约，并给出明确非零失败码。

#### 范围

- 包含：现有 `test/*.test.js` 补强、`scripts/verify-m0.ps1`、package scripts/files 清单。
- 不包含：安装、启动、浏览器 UI 和 profile 修改。
- 所属层：Verification/Tooling。

#### 前置条件与依赖

- 前置任务：T-002、T-003。
- 外部前提：系统 Node/npm/PowerShell 已确认可用。
- 依赖证据：Plan E-09、V-01..V-04。

#### 执行步骤

1. 先为验证脚本缺失/错误输入写失败测试或可复现检查。
2. 实现只读脚本：manifest/exports/patch/文件存在性、identity 一致性、禁用 token/依赖扫描。
3. 可选参数仅用于读取指定 `-ProfileDir`、`-BaseUrl`、工具快照；任何写操作视为失败。
4. 添加 `npm test` 和 `npm pack --dry-run --json` 验证入口。

#### 输出物

- 文件：`scripts/verify-m0.ps1`、测试补强、package scripts/files。
- 中间产物：TAP、pack JSON、verify JSON/文本摘要。

#### 约束边界

- 安全：脚本不执行 install/remove，不删除目录，不覆盖 profile。
- 资源：有限文件读取和 HTTP GET；必须有超时。
- 并发/ISR/DMA：不适用。
- SOLID：Verification 与产品代码隔离，失败原因可定位。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `static/host/build` |
| 命令或条件 | `cwd=D:\zhuomian\dsh-embedded-workbench; npm test; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-m0.ps1; npm pack --dry-run --json` |
| 预期结果 | 全部退出码 0；pack 不包含 test/runtime 或内部 Workflow State；禁止项 0 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-004/` |
| 当前状态 | `pass` |

#### 失败处理与回滚

- 定位顺序：Node tests -> PowerShell 参数/路径 -> pack files -> 禁止项。
- 重试/降级：不允许忽略失败或把 stderr 当通过。
- 回滚：回退 T-004 范围，不触碰产品行为。
- 回传条件：验证需要扩大 package 产品接口时回到 Integration Plan。

### T-005：建立测试期工具集合观察器

| 字段 | 内容 |
|---|---|
| order | `5` |
| parallel_group | `none` |
| source_plan_ids | `P-06,V-08,G-06` |
| source_spec_ids | `V-M0-09` |
| owner_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| owner_skill | `mcu-workbench:tdd` |
| supporting_skills | `mcu-workbench:tools-verification` |
| allocation_evidence | rc.1 `ToolRuntime.schemas(scope)` 已由 `dsh-tools/lib/types/index.js:638-646` 确认 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

提供只存在于测试目录、只读取 `ctx.tools.schemas()` 并输出排序工具名快照的观察器。

#### 范围

- 包含：`test/runtime/tool-snapshot/package.json`、`index.js`、observer patch/disable-target patch、对应测试。
- 不包含：产品 exports、产品 bundle、Tool 注册或运行权限。
- 所属层：Test-only runtime fixture。

#### 前置条件与依赖

- 前置任务：T-004。
- 外部前提：rc.1 `ToolRuntime.schemas(scope)` 是公开只读投影；观察器可声明 `inject=["tools"]`。
- 依赖证据：`F:\DSH Desktop\...\@deepseek-ai\dsh-tools\lib\types\index.js:224-267,638-646`。

#### 执行步骤

1. 建立测试，确保 observer package 未进入根 package exports/files/dsh bundle。
2. 实现只读观察器，只调用 `ctx.tools.schemas().map(x=>x.name).sort()`，输出带 run/phase marker 的 JSON。
3. 准备两个 overlay：两次都加载 observer；baseline 额外禁用目标 row，candidate 启用目标 row。
4. 验证 observer 自身不调用 `ctx.tools.register`。

#### 输出物

- 文件：`test/runtime/tool-snapshot/**`、`test/runtime/*.patch.yml`、局部测试。
- 中间产物：observer host test 日志。

#### 约束边界

- ISP：测试期只读依赖 tools；产品包仍无 tools 依赖。
- 生命周期：observer 无状态，输出一次快照后不注册资源。
- 并发/ISR/DMA：不适用。
- 发布边界：根 `npm pack --dry-run` 不得包含该 fixture。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `host` |
| 命令或条件 | `cwd=D:\zhuomian\dsh-embedded-workbench; node --test test/*tool*.test.js; npm pack --dry-run --json` |
| 预期结果 | observer 只读；快照排序稳定；根 pack 不包含 observer |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-005/` |
| 当前状态 | `pass` |

#### 失败处理与回滚

- 定位顺序：rc.1 API -> inject 时序 -> JSON marker -> pack exclusion。
- 重试/降级：不能改用源码扫描替代运行态集合。
- 回滚：移除 T-005 test-only 文件。
- 回传条件：rc.1 实际运行 API 与已读代码不一致时阻塞并回到 Integration Plan。

### T-006：完成隔离 rc.1 安装与 Loader 验证

| 字段 | 内容 |
|---|---|
| order | `6` |
| parallel_group | `none` |
| source_plan_ids | `P-08,V-05..V-07,G-07` |
| source_spec_ids | `V-M0-05,V-M0-06` |
| owner_agent | `toolchain-engineer` |
| support_agents | `verification-engineer` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:workflow-ai-collab` |
| allocation_evidence | Desktop rc.1 CLI 和官方 plugin reconcile 已确认；Plan 第 11.2 节 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

在项目内隔离 DSH_HOME 中证明官方安装、composed config、Host marker 和 client HTTP 路由均成立。

#### 范围

- 包含：`.mcu-workbench/runtime/<run-id>/dsh-home` 与当前 run 证据目录。
- 不包含：当前 `%APPDATA%` profile、F 盘官方 runtime 文件和源代码修改。
- 所属层：Runtime fixture/Tooling。

#### 前置条件与依赖

- 前置任务：T-005。
- 外部前提：Desktop Node `v24.9.0`、DSH `0.1.1-rc.1`、pnpm `10.33.0` 可用；选择的端口空闲。
- 依赖证据：Plan E-04/E-07/E-09。

#### 执行步骤

1. 解析并验证隔离 DSH_HOME 位于项目 `.mcu-workbench/runtime/<run-id>` 内，记录当前用户 profile 受保护文件 SHA-256。
2. 用 Desktop Node/DSH 执行 `plugin --profile web add file:D:/zhuomian/dsh-embedded-workbench`；另将 test observer 作为 bundleless dependency 安装到隔离 profile。
3. 保存安装后的 manifest/lock/bundle 集合和哈希，运行 rc.1 `--dump-config`。
4. 启动隔离 Web（`--no-open --host 127.0.0.1 --port <free-port>`），记录 PID、端口、完整日志。
5. GET 根路由和 `/plugins/@dsh-embedded/dsh-embedded-workbench/client.js`，保存状态与内容哈希。

#### 输出物

- 外部 fixture：隔离 DSH_HOME。
- 证据：before/after manifest、lock、bundle、dump、日志、HTTP/哈希。

#### 约束边界

- 只允许写隔离 DSH_HOME；当前 profile 和官方 runtime 只读。
- 后台进程必须记录 PID，测试结束有界停止；不杀无关进程。
- 无硬件、ISR、DMA 或固件资源。
- 失败不得用现有 5775 后端的 HTTP 200 冒充新包加载。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `target（Desktop rc.1 host/runtime）` |
| 命令或条件 | `cwd=D:\zhuomian\dsh-embedded-workbench; $env:DSH_HOME=<isolated>; & 'F:\DSH Desktop\...\node.exe' 'F:\DSH Desktop\...\dsh\lib\bin.js' --profile web --dump-config`，随后启动 Web 与 HTTP GET |
| 预期结果 | add/dump 各退出码 0；目标 row 唯一；marker 恰好一次；client HTTP 200；无目标错误 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-006/` |
| 当前状态 | `pass` |

#### 失败处理与回滚

- 定位顺序：路径/版本 -> pnpm -> manifest -> bundle -> dump -> Host -> client route。
- 重试/降级：最多对同一已定位环境错误重试一次；不切换 rc.2。
- 回滚：进入 T-009；若进程仍运行先按记录 PID 有界停止。
- 回传条件：必须写当前 profile或修改官方 runtime 才能通过时回到 Review Gate。

### T-007：证明运行态工具集合零增量

| 字段 | 内容 |
|---|---|
| order | `7` |
| parallel_group | `none` |
| source_plan_ids | `V-08,G-06` |
| source_spec_ids | `V-M0-02,V-M0-09` |
| owner_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:tdd` |
| allocation_evidence | 同 profile/同 preset、目标 row disabled/enabled 的 exact set diff 消除静态扫描盲区 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

在同一隔离 rc.1 composition 中证明启用目标 row 前后可见工具名集合完全相同。

#### 范围

- 包含：T-005 overlays、T-006 隔离 profile、两次启动日志和 JSON diff。
- 不包含：任何产品代码修改、工具注册或功能调用。
- 所属层：Runtime verification。

#### 前置条件与依赖

- 前置任务：T-006。
- 外部前提：目标 row 与 observer row 均可装配；两次运行使用相同 profile/preset/环境。
- 依赖证据：Spec V-M0-09；rc.1 `ToolRuntime.schemas()`。

#### 执行步骤

1. baseline：加载 observer overlay 并禁用目标 row，捕获排序工具名 JSON。
2. candidate：加载相同 observer overlay并启用目标 row，捕获排序工具名 JSON。
3. 比较集合和原始数量，生成 `added`、`removed`、`unchanged_count`。
4. 确认产品 manifest/源码无 tools 依赖或注册点，作为辅助证据而非替代证据。

#### 输出物

- `baseline-tools.json`、`candidate-tools.json`、`tool-diff.json`、两次运行日志。

#### 约束边界

- 两次运行仅允许目标 row enable 状态不同。
- observer 自身不注册 Tool；比较必须按名称 exact set，不按数量近似。
- 资源：两个进程串行启动/停止，禁止并行污染端口和日志。
- 硬件边界：不适用。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `target（Desktop rc.1 runtime）` |
| 命令或条件 | `cwd=D:\zhuomian\dsh-embedded-workbench; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-m0.ps1 -BaselineTools <baseline.json> -CandidateTools <candidate.json>` |
| 预期结果 | `added=[]`、`removed=[]`，退出码 0 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-007/` |
| 当前状态 | `pass` |

#### 失败处理与回滚

- 定位顺序：profile/preset 同一性 -> observer -> target row 状态 -> JSON -> set diff。
- 重试/降级：不接受“数量相同”或静态无 token 作为通过。
- 回滚：停止运行进程，保留快照；不修改产品实现以掩盖观察器问题。
- 回传条件：集合变化涉及批准范围外依赖时停止并回到 Review Gate。

### T-008：完成 Settings UI 人工验收

| 字段 | 内容 |
|---|---|
| order | `8` |
| parallel_group | `none` |
| source_plan_ids | `V-09` |
| source_spec_ids | `V-M0-04` |
| owner_agent | `verification-engineer` |
| support_agents | `system-architect` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:frontend-excellence` |
| allocation_evidence | 名称观察面由用户选择并写入批准 Spec；Loader/HTTP 不能替代 UI |
| confidence | `user-confirmed` |
| status | `pass` |

#### 目标

在隔离 rc.1 Web Settings 中人工确认名称可见、可点击、刷新/重启后仍存在且控制台无目标错误。

#### 范围

- 包含：隔离 Web UI、Settings 左侧导航、目标 section、浏览器控制台。
- 不包含：完整工作台功能和当前 Desktop 生产 profile。
- 所属层：Client acceptance。

#### 前置条件与依赖

- 前置任务：T-007。
- 外部前提：T-006 Web 进程可访问，目标 client 路由 200。
- 依赖证据：Spec F-14/V-M0-04。

#### 执行步骤

1. 打开隔离 Web URL，进入 Settings。
2. 检查左侧精确 label，点击并检查最小内容。
3. 刷新页面复查；重启同一隔离 Web 后再次复查。
4. 检查控制台和后端日志无目标插件错误；记录检查结果/截图。

#### 输出物

- UI 验收记录、URL/时间、刷新/重启结果、控制台摘要、截图（可用时）。

#### 约束边界

- 不把 client HTTP 200 直接判定为 UI 通过。
- 不写当前用户 profile，不触发安装市场、命令或硬件操作。
- 无并发、ISR、DMA 或内存专项。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `target（browser UI on Desktop rc.1 runtime）` |
| 命令或条件 | 人工检查：Settings 左侧 label、点击、刷新、重启、控制台 |
| 预期结果 | 精确显示“嵌入式开发工作台”；内容可渲染；刷新/重启后存在；无目标错误 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-008/` |
| 当前状态 | `pass` |

#### 失败处理与回滚

- 定位顺序：HTTP bundle -> ModuleLoader -> inject -> settings slot -> render -> console。
- 重试/降级：不允许改用 inventory short name 作为通过。
- 回滚：停止 UI 进程，进入 T-009。
- 回传条件：Settings 契约与 rc.1 代码证据冲突时回到 Integration Plan。

### T-009：精确卸载并证明环境回滚

| 字段 | 内容 |
|---|---|
| order | `9` |
| parallel_group | `none` |
| source_plan_ids | `V-10,G-07` |
| source_spec_ids | `V-M0-07,W-08` |
| owner_agent | `toolchain-engineer` |
| support_agents | `verification-engineer` |
| owner_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:tools-quality` |
| allocation_evidence | rc.1 plugin reconcile 在 remove 后精确移除 dependency 对应 bundle；Spec 要求其他 bundle 保持 |
| confidence | `confirmed` |
| status | `pass` |

#### 目标

从隔离 profile 精确移除目标包，并以配置、路由、UI、工具和受保护文件证据证明没有残留或旁损。

#### 范围

- 包含：隔离 profile 的官方 remove、回滚后 dump/start/check、受保护哈希复核。
- 不包含：删除整个隔离证据目录、当前用户 profile 和仓库源码回退。
- 所属层：Runtime rollback verification。

#### 前置条件与依赖

- 前置任务：T-008。
- 外部前提：T-006 保存安装前基线；目标进程 PID 已记录并可有界停止。
- 依赖证据：rc.1 `plugin-9h8shc4d.js:46-77,101-126`；Spec V-M0-07。

#### 执行步骤

1. 停止记录的隔离 Web PID，确认端口释放。
2. 在同一隔离 DSH_HOME 执行官方 `plugin --profile web remove @dsh-embedded/dsh-embedded-workbench`。
3. 重新 dump/start，确认目标 row、marker、client route 和 UI 消失；client route 预期 404。
4. 比较其他 dependency/bundle 集合、工具集合和当前用户 profile 受保护 SHA-256。
5. 保留隔离目录与全部证据供最终 Verify，不自动删除。

#### 输出物

- remove 输出、回滚后 manifest/lock/bundle/dump、HTTP/UI/工具检查、保护哈希报告。

#### 约束边界

- 只允许移除目标 package ID；observer fixture 可在完成证据后单独精确移除。
- 禁止整文件覆盖、递归删除宽泛目录、终止无关进程。
- 无硬件、ISR、DMA 或固件资源。
- 回滚证据不等于源代码撤销。

#### 验证

| 字段 | 内容 |
|---|---|
| 证据等级 | `target（Desktop rc.1 runtime）` |
| 命令或条件 | `cwd=D:\zhuomian\dsh-embedded-workbench; $env:DSH_HOME=<isolated>; & $DesktopNode $DshBin plugin --profile web remove '@dsh-embedded/dsh-embedded-workbench'`，随后 dump/start/HTTP/hash/set checks |
| 预期结果 | 目标消失；其他 bundle/工具不变；当前用户 profile 哈希不变；退出码 0 |
| 产物位置 | `.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/runs/<run-id>/T-009/` |
| 当前状态 | `pass` |

#### 失败处理与回滚

- 定位顺序：remove exit -> dependency -> bundle -> row -> route/UI -> protected hash。
- 重试/降级：只允许一次精确 remove 重试；禁止覆盖完整 manifest。
- 回滚：保留失败环境和证据，停止进一步写入。
- 回传条件：其他 bundle 或当前 profile 发生变化时立即阻塞并报告精确差异。

## 5. 任务级验收汇总

| task_id | 验收项 | 证据等级 | 命令/条件 | 预期结果 | 产物 | 状态 |
|---|---|---|---|---|---|---|
| T-001 | 包/patch 身份自洽 | static/host | `node --test test/package-contract.test.js` | 单包单 row、禁用依赖 0 | T-001 log | `pass` |
| T-002 | Host 无能力加载 | host | backend test + `node --check` | marker 一次、ctx 零访问 | T-002 log | `pass` |
| T-003 | Client section 与清理 | host | client test + `node --check` | ID/label/cleanup 正确 | T-003 log | `pass` |
| T-004 | 统一只读验证 | static/host/build | `npm test`、verify script、pack dry-run | 全部 0；产品包边界正确 | T-004 logs | `pass` |
| T-005 | 工具观察器隔离 | host | observer tests + pack dry-run | 只读且不进入产品 pack | T-005 logs | `pass` |
| T-006 | rc.1 安装/Loader | target | plugin add/dump/start/HTTP | row/marker/client 通过 | T-006 artifacts | `pass` |
| T-007 | 工具集合零增量 | target | exact set diff | added/removed 均为空 | tool-diff.json | `pass` |
| T-008 | Settings UI | target | 点击/刷新/重启/控制台 | 名称可见且无错 | UI record | `pass` |
| T-009 | 精确回滚 | target | plugin remove + diff/hash | 无残留、无旁损 | rollback report | `pass` |

所有 Task 通过后才进入最终 Verify；以上 target 指 Desktop rc.1 host/browser runtime，不是 MCU 目标板。物理/目标板证据明确为 `not_applicable`。

## 6. 阻塞与未验证项

| ID | 类型 | 内容 | 影响任务 | 证据/补证动作 | 状态 |
|---|---|---|---|---|---|
| U-01 | 已验证 | 新包代码、包测试、安装、启动、UI 与回滚证据已齐备 | T-001..T-009 | T-001..T-009 执行记录与最终 Verify 追踪矩阵 | `closed` |
| U-02 | 已验证 | 隔离 rc.1 profile 初始化、安装、UI 和回滚已运行 | T-006..T-009 | 项目内隔离 DSH_HOME 的 Desktop rc.1 证据 | `closed` |
| U-03 | 已验证 | 新包加载前后工具集合差为零 | T-007 | Desktop rc.1 observer 两次快照和 exact set diff | `closed` |
| R-01 | 风险 | 当前 profile-local rc.2 依赖闭包损坏 | none（排除项） | 不使用 rc.2，不声明兼容；后续版本矩阵单独治理 | `open/non-blocking` |

## 7. 下游交接

- 需求/约束输入：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\spec.md`
- 实施路线输入：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\plan.md`
- 任务清单：`D:\zhuomian\dsh-embedded-workbench\00_Docs\04_需求文档\task.md`
- 阶段级 Agent/Skill 基线：`plan.md` 第 8A 节。
- 任务级分配：每项详情中的 `owner_agent/support_agents/owner_skill/supporting_skills`。
- 执行规则：`workflow-task-execution` 使用 `auto_until_final_check`；按拓扑顺序执行，同一时刻只修改一个 Task 范围；T-002/T-003 逻辑可并行但默认串行；禁止跳过 T-004/T-005 直接运行环境验收。
- Task 测试与最终 Verify：每项局部测试通过后继续下一项；T-009 完成后统一对照 Spec V-M0-01..09 Verify。
- 代码完成后：交接 `workflow-final-review`。
- 新事实回传：任务粒度/命令问题回 `workflow-integration-plan`；需求、范围、接口、权限、验收变化回 `workflow-review-gate`。
