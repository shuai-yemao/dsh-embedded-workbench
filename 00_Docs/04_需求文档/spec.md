# DSH Embedded Workbench Spec

> 版本：v0.1
> request_id：`REQ-DSH-EW-M0-20260826`
> 项目：`D:\zhuomian\dsh-embedded-workbench`
> 当前 Git：`main`（unborn，无提交）
> Spec 力度：`full + versioned`
> 审查状态：`approved`
> 用户审查状态：`H-02 approved`
> 代码阶段判定：`等待 H-03 方案选择，尚不得进入代码阶段`

| 工作流字段 | 内容 |
|---|---|
| request_id | `REQ-DSH-EW-M0-20260826` |
| Spec 版本 | `v0.1` |
| Spec 状态 | `approved-for-integration-plan` |
| 用户审查状态 | `approved` |

以上表格是工作流门禁的机器可读元数据；需求、范围和验收内容仍以本文件正文为准。

本文件由内部 RCP、Challenge 结论和 Review-Package 四张清单整合生成。RCP 与
Review-Package 保存在内部 Workflow State，不另生成 `RCP.md` 或独立清单文档。
本轮只产出 Spec，不生成 `plan.md`、`task.md`，也不修改插件实现。

## 0. 目标、范围与非目标

### 0.1 产品目标

创建一个独立于现有 `mcu-workbench` 的 DeepSeek Harness 嵌入式开发工作台。产品长期目标是
在 Harness 中提供 UI，并把工程操作与真实底层硬件的构建、烧录、运行和观测连接成可审计闭环。
现有 `mcu-workbench` 只作为规则、Skills 和局部实现的来源之一，不作为新插件的宿主仓库或官方核心修改点。

产品能力池来自会话中的用户原始需求，全部保留：

| ID | 长期能力 | 当前可信等级 | 本 Spec 处理方式 |
|---|---|---|---|
| PC-01 | Harness 内嵌入式工作台 UI | `user-confirmed` | M0 只建立最小可见入口；完整 UI 延后 |
| PC-02 | UI 与底层硬件实现闭环 | `user-confirmed` | M0 不接硬件；后续按证据等级推进 |
| PC-03 | LVGL 界面开发 | `user-confirmed` | 后续使用自集成 LVGL 基线 |
| PC-04 | 端侧 AI 训练与工程接入 | `user-confirmed` | 后置，不进入 M0 |
| PC-05 | 异常事件监控与事故复盘 | `user-confirmed` | 后续进入监控/复盘里程碑 |
| PC-06 | 日志信息观察与串口交互 | `user-confirmed` | 后续进入观测里程碑 |
| PC-07 | 传感器数据监控 | `user-confirmed` | 后续进入硬件闭环里程碑 |
| PC-08 | 平台化代码生成 | `user-confirmed` | 后续受 Spec、沙箱和审批门禁约束 |
| PC-09 | 项目 DevOps 与 Git 管理 | `user-confirmed` | 后续独立能力，不在 M0 修改 Git 外部状态 |
| PC-10 | 项目单元测试与验证 | `user-confirmed` | M0 先建立插件自身测试入口 |

### 0.2 本轮直接范围：M0 最小插件注册

M0 只交付一个可被当前 DSH web profile 组合和加载的最小独立插件：

1. 使用独立包身份；包名为 `@dsh-embedded/dsh-embedded-workbench`，显示名为“嵌入式开发工作台”；
2. 能加入 DSH profile 的 `dependencies` 与 `dsh.profile.bundles`；
3. 能通过真实 Loader 路径加载，不注册任何模型工具；
4. 在 DSH Settings 左侧注册独立 `settings.section`，显示“嵌入式开发工作台”；
5. 加载失败时不得静默成功，必须留下可定位的启动错误；
6. 安装和卸载可回滚，不覆盖或删除现有 profile 的其他 bundle。

第 4 条已经由用户采用推荐契约并回填为 `user-confirmed`；包名和显示名随 H-02 Spec 批准
一并成为 M0 正式约束，但尚不是已发布公共契约。

### 0.3 M0 明确不包含

- 不注册 `defineTool`，不提供模型可调用工具；
- 不创建 Driver、Service、Provider、Consumer 或硬件访问能力；
- 不实现生命周期对象、状态持久化、依赖注入、业务配置或事件通信；
- 不实现日志面板、串口、传感器、构建、烧录、调试、LVGL 或端侧 AI；
- 不实现工作流、代码生成、沙箱、审批、DevOps 或 Git 写操作；
- 不发布到市场或 npm，不承诺公共 API 兼容性；
- 不修改 `D:\zhuomian\embedded_framework`；
- 不把 profile 配置成功、HTTP 200 或后端启动写成 UI 已验证。

### 0.4 后续里程碑登记（非 M0 施工授权）

| 里程碑 | 需求出口 | 与下一阶段的门禁 |
|---|---|---|
| M0 | 最小注册、名称可见、零工具 | H-02 Spec 批准后才能生成 Plan |
| M1 | 插件对象与生命周期管理 | 明确状态机、资源所有权、清理和失败状态 |
| M2 | 声明并注入辅助插件依赖 | 锁定 required/optional、缺失依赖和版本策略 |
| M3 | 用 Driver/Service 对象管理形成第一个 Harness 工具 | 先定义接口、Provider、Consumer、权限和输出 schema |
| M4 | 插件配置 | 明确配置 schema、默认值、校验、迁移和敏感字段 |
| M5 | Harness 事件通信与插件日志 | 明确事件语义、顺序、失败传播、订阅清理和可观测性 |
| M6 | 整体架构与错误处理 | 按 Definition/Provider/Consumer seam 和 SOLID 审查 |
| M7 | Bundle 组合、安装与发布 | 明确版本、兼容、安装、升级和回滚证据 |
| M8 | 嵌入式工作流、沙箱与审批 | 高权限动作必须有最小权限、审批、审计和失败闭环 |
| M9 | 事故复盘与需求池闭环 | 复盘系统性逃逸原因，新增测试/规则/ADR 后进入下一轮 RCP |

总体优先级继续采用用户已确认的“工程与固件基座优先、UI 随后、端侧 AI 后置”；M0 是所有
能力之前的插件加载基座。每个里程碑都必须重新经过需求变化门禁，不能用本路线图直接授权施工。

## 1. 工程现状表

| ID | 已知事实 | 证据 | 可信等级 | 影响范围 | 待确认/补证 |
|---|---|---|---|---|---|
| F-01 | 新插件必须独立于现有 mcu-workbench | 会话记录 405-426 行 | `user-confirmed` | 仓库、包身份、依赖 | 无 |
| F-02 | 目标仓库为 `D:\zhuomian\dsh-embedded-workbench` | 会话记录 731-735、882-884 行 | `user-confirmed` | 全项目 | 无 |
| F-03 | 当前仓库只有空 `src/`、`scripts/` 目录，`main` 无提交 | `git status --short --branch`、`git log` | `confirmed` | M0 全部文件均为新增 | 无 |
| F-04 | 当前 DSH web profile 使用 `@deepseek-ai/dsh` `0.1.1-rc.2` | `%APPDATA%/.../profiles/web/package.json` | `confirmed` | 当前兼容基线 | 后续升级需重审 |
| F-05 | profile 通过 `dependencies` 和 `dsh.profile.bundles` 组合插件 | 同上；DSH `plugin-*.js` | `confirmed` | 安装/卸载契约 | 无 |
| F-06 | profile-local DSH `0.1.1-rc.2` 的 `dsh web --dump-config` 当前退出码为 1，缺少 `@deepseek-ai/cordis-plugin-group` | 系统 Node 与 Desktop bundled Node 复跑 | `confirmed` | M0 不使用该入口，也不宣称 rc.2 兼容 | 作为版本漂移风险保留 |
| F-07 | 现有 mcu 插件使用 `dsh.bundle.patch` 挂载 Cordis row | `.dsh-plugin/cordis/package.json:18-29`、`cordis.patch.yml:1-6` | `confirmed` | M0 可参考的 bundle 机制 | 不可直接复制工具实现 |
| F-08 | 现有 mcu 客户端通过 `__ModuleLoader__.load` 与 `settings.section` 显示名称 | `.dsh-plugin/cordis/lib/client.js:44-66` | `confirmed` | UI 机制先例 | 新插件独立实现，不复制业务面板 |
| F-09 | 后续固件工程为 `D:\zhuomian\embedded_framework`，当前主要是 STM32F411 绑定 | 该仓库 `CMakeLists.txt`、`04_Impl/impl_mcu`、`05_Vendor/vendor_mcu` | `confirmed` | M1 以后硬件闭环 | M0 不施工 |
| F-10 | 正点原子 ESP32-S3、LVGL 自集成、实机烧录与串口回读是后续基线 | 会话记录 731-735、882-884 行 | `user-confirmed` | 后续硬件/观测 | 串口当前未插入 |
| F-11 | ESP-IDF v5.4.2 路径存在，VS Code 设置指向该路径 | `F:\Espressif\...`、VS Code `settings.json:169-170` | `confirmed` | 后续工具链 | 不证明能构建/烧录 |
| F-12 | Desktop 当前实际运行 DSH `0.1.1-rc.1`，`127.0.0.1:5775` 根路由和现有 mcu client 路由均 HTTP 200 | F 盘 runtime、`harness.log:1801-1816`、本轮 HTTP 只读检查 | `confirmed` | 证明 Desktop rc.1 与现有插件运行，不证明新 M0 包 | 与 profile rc.2 分开记录 |
| F-13 | 当前存在版本分叉：Desktop DSH rc.1、web profile DSH rc.2、现有 mcu 插件 `dsh-tools` rc.1 | 三处 `package.json` | `confirmed` | M0 兼容基线和复现路径 | Plan 前治理或锁定基线 |
| F-14 | M0 采用 Settings 左侧独立 `settings.section` + 后端加载日志 + 工具集合零增量作为名称/注册验收 | 用户回复“采用推荐契约” | `user-confirmed` | client 文件、依赖和 V-M0-04/V-M0-09 | 无 |
| F-15 | 用户批准 `spec.md` v0.1 | 用户回复“批准spec” | `user-confirmed` | M0 全部范围、包名、非目标和验收边界 | 进入 H-03 方案选择 |

### Challenge 质疑结论

- 目的结论：`user-confirmed`。真实目标是先建立可验证、可扩展的 DSH 插件基座，再逐步形成嵌入式开发闭环；不是直接迁移全部 mcu-workbench。
- 可行性结论：`可行`。M0 验收基线限定为当前 Desktop DSH rc.1；profile-local rc.2 的依赖闭包问题保留为版本漂移风险，不属于本轮兼容声明。
- 范围结论：M0 的直接范围和非目标清晰；后续能力只进入需求池和路线图。
- 验收缺口：新插件的静态、包测试、真实 Loader、后端启动、工具集合差和浏览器 UI 尚未执行；这些是实施后的验收项。
- 未决风险：Desktop rc.1、profile rc.2 与现有 mcu 插件依赖存在版本漂移；M0 不得把 rc.1 证据外推为 rc.2 兼容。

### 当前真实 Client Loader 链

当前 DSH 代码证据确认以下链路；它用于约束 M0 测试，不代表新包已经通过：

```text
profile dependencies + dsh.profile.bundles
-> Cordis row name = package name
-> ClientModuleRegistry 枚举 ctx.loader.entries()
-> require.resolve(<package>/package.json)
-> 读取 dsh.client.platform=web 与 exports["./client"]
-> /plugins/<id>/client.js?rev=<hash>
-> window.__ModuleLoader__.load({ id })
-> client 注入 settings.section
-> Settings 左侧导航显示 label
```

插件 inventory 是另一观察面，它通常显示 package short name，不自动等价于中文产品显示名。用户已确认
M0 必须包含 client bundle、slots 依赖和 Settings 人工 UI 验收。

## 2. 文件施工清单

以下清单是 Review Gate 对 M0 的候选施工边界，不代表已经批准施工。

| ID | 动作 | 文件/目录 | 所属边界 | 施工内容与理由 | 前置事实 | 责任 | 状态 |
|---|---|---|---|---|---|---|---|
| W-01 | 新增 | `package.json` | Package/Bundle | 声明独立包、exports、`dsh.bundle.patch` 和必要 peer dependency | F-04/F-05/F-07 | toolchain-engineer | `ready` |
| W-02 | 新增 | `cordis.patch.yml` | DSH composition | 只插入本插件 row，不覆盖其他 bundle | F-05/F-07 | system-architect | `ready` |
| W-03 | 新增 | `src/index.js` | Backend plugin | 最小 `name/apply`；禁止注册工具、服务和持久状态 | F-03/F-07 | firmware-engineer | `ready` |
| W-04 | 新增 | `src/client.js` | Web client | 注册最小 `settings.section` 名称入口并提供对称 effect cleanup | F-08/F-14 | frontend/client owner | `ready` |
| W-05 | 新增 | `test/` | Verification | manifest/patch、Proxy 主机测试、零工具三层证据、真实 Loader/组合路径回归 | F-04-F-08/F-12-F-13 | verification-engineer | `ready` |
| W-06 | 新增 | `scripts/verify-m0.*` | Tooling | 只读验证当前包与指定 profile；不得静默写入或删除其他 bundle | F-05 | toolchain-engineer | `ready` |
| W-07 | 不建议动 | `D:\zhuomian\embedded_framework` | External firmware | M0 与硬件无关，避免范围漂移 | F-09-F-11 | embedded-lead | `locked` |
| W-08 | 不建议动 | `%APPDATA%\...\profiles\web` | Installed profile | Spec 阶段不得安装；施工后安装必须精确、可回滚并保留现有配置 | F-04-F-06 | toolchain-engineer | `locked` |

M0 不涉及 CubeMX、ESP-IDF 生成文件、ISR、DMA、RTOS 任务或 MCU 内存资源。

## 3. 代码生成约束清单

| ID | 类别 | 约束 | 证据 | 禁止事项 | 未决项 | 状态 |
|---|---|---|---|---|---|---|
| G-01 | 范围 | 后端只提供最小插件加载入口 | M0-01、W-03 | `defineTool`、Service/Driver、文件/进程/网络/串口访问 | 无 | `ready` |
| G-02 | Composition | patch 只新增本插件 row | F-05/F-07 | 替换完整 profile、覆盖其他 row、修改官方 core | 无 | `ready` |
| G-03 | 依赖 | M0 只声明 backend 加载与 client `settings.section` 所需最小依赖 | F-14、SRP/ISP/DIP | 预装未来里程碑依赖、依赖现有 mcu 私有实现 | 无 | `ready` |
| G-04 | 生命周期 | M0 不实现产品级生命周期对象；client 注册资源必须有对称 cleanup | F-08/F-14、SOLID LSP | 悬挂 UI slot、全局状态、不可逆副作用 | 无 | `ready` |
| G-05 | 错误 | import/apply/装配失败必须返回非成功结果或明确日志 | 事故复盘方法 | 吞错、仅凭 HTTP 200/超时宣称成功 | 日志格式在 Plan 固化 | `ready` |
| G-06 | 安全 | M0 无模型工具、无外部命令、无硬件权限 | 用户范围 | 沙箱绕过、审批占位、隐式执行 | 无 | `ready` |
| G-07 | 兼容 | M0 验收基线锁定当前 Desktop DSH `0.1.1-rc.1`；rc.2 不在本轮声明内 | F-06/F-12/F-13 | 用 rc.1 运行证据宣称 rc.2 兼容 | 发布前建立版本矩阵 | `ready` |
| G-08 | 固件分层 | 后续固件保持 `App -> Service -> Platform <- Impl -> Vendor` | 插件软件层契约 | App/Service 直调 ESP-IDF/HAL、把 Vendor 类型泄漏上层 | M0 不适用 | `ready` |

### SOLID 施工门禁

| 原则 | M0 约束 | 预期证据 | 当前状态 |
|---|---|---|---|
| SRP | manifest、composition、backend、client、verification 各自单一职责 | 文件职责与测试映射 | `pending` |
| OCP | 后续能力通过新增 row/模块/稳定扩展点加入，不改官方 core | patch 仅 insert；官方文件无 diff | `pending` |
| LSP | 插件加载/卸载遵守 DSH 生命周期，资源对称清理 | Loader + dispose/cleanup 测试 | `pending` |
| ISP | M0 不依赖工具、硬件和未来 Service 接口 | 依赖清单与工具列表差异 | `pending` |
| DIP | 后续 Consumer 依赖 Definition，不直接依赖 Provider | M0 只登记，M3/M6 再形成接口证据 | `not_applicable_to_code` |

`solid_status: pending`，五项约束已定义，实施后必须用代码与测试证据逐项关闭。

## 4. 验收测试清单

| ID | 证据等级 | 验收项 | 命令/条件 | 预期结果 | 责任 | 当前状态 | 阻塞/产物 |
|---|---|---|---|---|---|---|---|
| V-M0-01 | 静态 | manifest/exports/patch 自洽 | 在目标仓库执行包校验脚本 | 包名、exports、patch 路径存在；无越界路径 | verification-engineer | `not-run` | 尚无文件 |
| V-M0-02 | 静态 | M0 无工具依赖或注册点 | 同时检查 `defineTool`、`ctx.tools.register`、`inject: ["tools"]`、`@deepseek-ai/dsh-tools` 依赖 | 四类均不存在 | verification-engineer | `not-run` | 尚无代码 |
| V-M0-03 | 主机/包测试 | `apply()` 不访问工具服务，client 注册与 cleanup 对称 | Proxy/Fake `ctx` 对任何 `tools` 访问立即失败；捕获 ModuleLoader/slot 注册和清理 | 不访问 tools；注册/清理成对 | verification-engineer | `not-run` | 尚无包 |
| V-M0-04 | UI 人工 | Settings 显示插件名称 | Desktop DSH rc.1；重启/刷新后打开 Settings 左侧导航 | 可见“嵌入式开发工作台”，点击可渲染且控制台无错 | user + verification-engineer | `not-run` | 实施后执行 |
| V-M0-05 | 配置装配 | 隔离的 Desktop rc.1 验收环境只新增目标 bundle | 装配前后比较 manifest/lock/bundle tree；当前 profile-local rc.2 dump 不作为通过入口 | 只新增目标 dependency/bundle/row | toolchain-engineer | `not-run` | Plan 固化隔离入口 |
| V-M0-06 | 后端/真实 Loader | 实际 Loader 激活目标 row 并提供 client 路由 | 启动隔离 profile，检查 fiber active、目标 client HTTP 路由和目标错误日志 | 后端进入已知服务状态，目标路由符合 F-14，无目标错误 | toolchain-engineer | `not-run` | 不等同 UI 通过 |
| V-M0-07 | 回滚 | 卸载目标 bundle | 移除目标包后再次 dump/start | 目标 bundle 消失，其他依赖和 bundle 保持 | toolchain-engineer | `not-run` | 需要安装前快照 |
| V-M0-08 | 目标板/实物 | ESP32-S3 烧录、串口回读 | 不适用于 M0 | 明确记录 `not_applicable`，不得冒充完成 | hardware-integration | `not_applicable` | 后续里程碑 |
| V-M0-09 | 运行态 | 加载前后工具集合完全相同 | 同一隔离 Desktop rc.1 环境、同一 preset，用仅测试期观察器读取 `ctx.tools.schemas()`/`knownNames` 做精确集合差 | 工具集合增量为空；观察器不随产品发布 | verification-engineer | `not-run` | 实施后执行 |

证据边界：静态校验不证明 Loader；Loader 不证明浏览器 UI；后端启动不证明桌面窗口；M0 不产生任何
ESP32-S3 目标运行或实物证据。

## 5. Review Gate 结论

### 可采用

- 独立仓库和独立包，不修改官方 DSH core；
- 使用当前 profile 的 bundle composition 机制；
- M0 严格限制为最小注册、名称可见和零工具；
- 后续可替换能力采用 Definition/Provider/Consumer seam：Definition 定义接口与类型，Provider 与
  Consumer 分别依赖 Definition，Provider/Consumer 互不依赖；
- 事故复盘关注“机制、逃逸的安全网、长期防护”，并把防护转成测试、规则或 ADR 后回流需求池。

### 需修订

- 旧会话将 `RCP.md`、`plan.md`、`task.md` 与 Spec 同时生成：本轮改为内部 RCP State，用户正式文档从 `spec.md` 开始；
- 旧会话把 ESP32-S3 固件迁移与插件 M0 混成同一施工范围：本轮将硬件工程固定为后续上下文；
- 旧会话把现有 mcu 客户端的 `settings.section` 直接当成新插件契约：本轮先降为证据先例，现已由用户明确确认采用该观察面。

### 门禁与剩余风险

| ID | 风险 | 影响 | 关闭条件 |
|---|---|---|---|
| B-01（已关闭） | “显示名称”的正式观察面曾未确认 | client bundle、slots 依赖和 UI 人工验收 | 用户已采用推荐契约并回填 F-14 |
| R-01 | profile-local rc.2 CLI 缺少 `@deepseek-ai/cordis-plugin-group` | rc.2 不可作为本轮复现入口 | M0 锁定 Desktop rc.1；不得宣称 rc.2 兼容 |
| R-02 | 新插件尚无实现与执行证据 | 当前只能放行需求边界，不能宣称 M0 完成 | H-02 后按 Plan 执行 V-M0-01..09 |

**代码阶段判定：等待 H-03。** H-02 已批准且没有未关闭的需求阻塞；当前已交给
`workflow-integration-plan` 生成两个候选方案，用户选定并通过方案审查前仍不得修改实现代码。

## 6. 下游交接与回传规则

- 当前下游：`workflow-integration-plan` 的 H-03 方案选择；
- Q-01 已回填：内部 RCP、Review-Package 与本 `spec.md` 已同步；
- H-02 已批准：`workflow-integration-plan` 已生成两个方案；用户选择后才审查并生成 `plan.md`；
- Plan 未批准前：不生成 `task.md`，不实现代码，不安装到当前 DSH profile；
- 发现新需求或改变范围、接口、权限、资源、验收时：回到 Router/Challenge，不在 Plan/Task 中静默扩展；
- 最终实现必须经过独立 Final Review、代码质量门禁和分级验证；
- 所有 profile 安装、发布、外部 Git 写操作和硬件高权限操作都必须在对应阶段重新确认权限与回滚方式。

## 7. 用户确认记录

**Q-01：M0 的“显示名称”是否按以下推荐契约验收？**

> 在 DSH 设置页创建独立的 `settings.section`，可见“嵌入式开发工作台”；同时后端启动日志能确认插件
> row 已加载。两项都通过才算“注册并显示名称”完成，且工具注册增量必须为 0。

用户回答：`采用推荐契约`。

回填结果：`user-confirmed / 已回填`。`src/client.js`、client peer dependencies、V-M0-04 和
V-M0-09 均属于 M0 正式范围。

**H-02：是否批准 `spec.md` v0.1？**

用户回答：`批准spec`。

回填结果：`approved`。本 Spec 现为正式 Plan 输入；批准不等于代码施工授权。

## 8. 证据索引

- 会话原始输入：`C:\Users\zhang\Documents\mcu-workbench\00_Docs\会话记录\本会话-2026-0826.md`
- 内部 Workflow State：`.mcu-workbench/workflows/REQ-DSH-EW-M0-20260826/state.json`
- DSH 当前 profile：`C:\Users\zhang\AppData\Roaming\dsh-desktop\harness\profiles\web\package.json`
- DSH 本地先例：`C:\Users\zhang\Documents\mcu-workbench\.dsh-plugin\cordis`
- 后续固件工程：`D:\zhuomian\embedded_framework`
- 能力 seam 参考：[Definition / Provider / Consumer](https://www.runoob.com/deepseek-harness/deepseek-harness-capability-seams.html)
- 事故复盘参考：[事故复盘与工程文化](https://www.runoob.com/deepseek-harness/deeseek-harness-postmortem.html)
