# DSH Embedded Workbench M2 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `mcu-workbench:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）跟踪进度；每个任务按 TDD 顺序执行并独立提交。

**目标：** 在保留 `@dsh-embedded/dsh-embedded-workbench` 单一安装入口和单一 Loader row 的前提下，实现 Bundle、Contracts、Core Supervisor、UI Shell、Reference Provider 五个高内聚包，并证明任一 Optional Provider 的缺失、禁用、版本不兼容、启动失败或清理失败不会影响 Core 和其他 Provider。

**架构：** 根包只负责 Bundle 组合、Host/Client Typert 装配和 Provider 描述符。Core 通过每能力独立 Operation Gate 与 Cordis child Fiber 监督 Provider，Settings 保存 `desired_enabled`，Typert Remote 投影实际状态；UI 仅消费 Settings 与 Remote。Reference Provider 是唯一产品 Provider，故障 Provider A/B 只作为测试实例存在。

**技术栈：** Node.js 22+、TypeScript 6.0.3、tsx 4.23.12、esbuild 0.28.2、Cordis 4.0.1、DeepSeek Harness 0.1.1-rc.2、Schemastery 3.18.1、Typert Generator 0.1.1-rc.2、Node Test Runner、PowerShell。

---

## 0. 执行基线、范围门和停止条件

- 文档基线提交：`d58c156`；正式执行基线是本 Plan 提交后的 `HEAD`。
- 正式输入：`00_Docs/04_需求文档/REQ-DSH-EW-M2-20260827/spec.md` v0.1 approved。
- 当前 M1 产品代码必须先通过：`npm test`、`npm run verify:m0`、`npm run verify:m1`。
- M2 只实现无硬件副作用的 Reference Provider；不得访问工程文件、进程、网络、串口、USB、调试器或 MCU。
- 不注册 Tool，不修改官方 DSH 包，不写当前用户 Profile，不关闭 M1 顶层 Loader reload 延期项。
- 所有 DSH peer/dev dependency 精确锁定 `0.1.1-rc.2`；Cordis 锁定 `4.0.1`。

以下任一条件出现时停止后续任务，保留失败证据并回到 Spec：

1. `dsh plugin --profile m2-isolated add` 无法按一次命令安装 required 包并容忍 Optional Provider 缺失；
2. rc.2 的 `settings.register/settingsScope.bind`、`ctx.typert.register`、`TypertRemoteService`、`ctx.remote.$mount` 或 `ctx.plugin()/Fiber` 与本计划签名不一致；
3. 需要修改官方 `API_REMOTE_FORWARDED_EVENTS`、Typert Loader 配置或新增自造通信总线才能完成状态同步；
4. Provider 失败必须回滚 Core 或兄弟 Provider 才能维持 Cordis 一致性。

失败时不得自动采用“Bundle 内嵌 Provider 产物”的 B2 方案；先把验证事实写入 Spec v0.2 并重新审查。

## 1. 文件结构与职责

### 根 Bundle

- 修改：`package.json`——workspace、精确依赖、构建/测试/验证脚本、唯一 DSH Bundle 元数据。
- 创建：`package-lock.json`——锁定开发和 workspace 依赖。
- 创建：`.gitignore`——忽略 `node_modules/`、根及各包 `lib/` 和隔离验证产物。
- 保留：`cordis.patch.yml`——仍只插入 `dsh-embedded-workbench` 一行。
- 修改：`src/index.js`——注册 Core 的生成 Typert Host 贡献并启动一个 Core child Fiber。
- 创建：`src/providers.js`——唯一 Provider 描述符表，不导入 Provider 实现。
- 创建：`src/client-entry.js`——挂载 Core 的生成 Remote descriptor。
- 删除：`src/client.js`——M0 手写 UI 入口由构建产物 `lib/client.js` 取代。
- 删除：`src/workbench-lifecycle.js`——生命周期所有权迁移到 Reference Provider。

### 构建与生成

- 创建：`tsconfig.base.json`、`tsconfig.json`、`tsconfig.host.json`、`tsconfig.client.json`。
- 创建：`scripts/generate-typert.mjs`——调用 `WorkspaceTypertGenerator` 写 Core Host/Remote 产物。
- 创建：`scripts/build-client.mjs`——用 esbuild 生成 ModuleLoader 兼容的 Bundle Client 和 UI Client。
- 创建：`scripts/verify-m2.ps1`——静态、包边界、生成物、零 Tool 与构建验证。
- 创建：`scripts/verify-m2-runtime.ps1`——隔离 `DSH_HOME`、一次安装、rc.2 启动、卸载和设置保留验证。
- 创建：`test/runtime/local-registry.mjs`——只服务本轮 tarball 的临时 npm registry。

### `@dsh-embedded/workbench-contracts`

- 创建：`packages/workbench-contracts/package.json`、`tsconfig.json`。
- 创建：`packages/workbench-contracts/src/index.ts`——ID、DTO、状态枚举、错误结构、Provider manifest 和兼容函数。
- 创建：`packages/workbench-contracts/test/contracts.test.ts`——严格快照和版本兼容测试。

### `@dsh-embedded/workbench-core`

- 创建：`packages/workbench-core/package.json`、`tsconfig.json`。
- 创建：`packages/workbench-core/src/catalog.ts`——有界状态表、revision、健康度和 JSON-safe 快照。
- 创建：`packages/workbench-core/src/provider-resolver.ts`——先读 package manifest 和兼容信息，再导入 Provider 代码。
- 创建：`packages/workbench-core/src/operation-gate.ts`——同能力串行、异能力独立、最新 desired 收敛。
- 创建：`packages/workbench-core/src/controller.ts`——独立 child Fiber 启停、失败隔离和清理。
- 创建：`packages/workbench-core/src/settings.ts`——`dshEmbedded.workbench` schema、scope 和变更协调。
- 创建：`packages/workbench-core/src/gateway.ts`——`list/retry/reconcile` Typert Remote。
- 创建：`packages/workbench-core/src/index.ts`——Core 组合根与逆序释放。
- 创建：`packages/workbench-core/test/*.test.ts`——Catalog、Resolver、Gate、Controller、Settings、Gateway 测试。

### `@dsh-embedded/workbench-ui`

- 创建：`packages/workbench-ui/package.json`、`tsconfig.json`。
- 创建：`packages/workbench-ui/src/controller.ts`——Settings/Remote 合并、刷新、写入、重试、重置和有界轮询。
- 创建：`packages/workbench-ui/src/client.tsx`——Settings section、能力卡片、持续错误和确认对话框。
- 创建：`packages/workbench-ui/test/controller.test.ts`、`client.test.tsx`。

### `@dsh-embedded/provider-reference`

- 创建：`packages/provider-reference/package.json`、`tsconfig.json`。
- 创建：`packages/provider-reference/src/lifecycle.ts`——Reference 自有资源栈和有界逆序清理。
- 创建：`packages/provider-reference/src/index.ts`——manifest 与 Cordis Provider plugin。
- 创建：`packages/provider-reference/test/provider.test.ts`——正常、启动失败、清理失败和实例隔离。

### 现有回归测试

- 修改：`test/backend.test.js`、`test/client.test.js`、`test/cordis-host.test.js`、`test/package-contract.test.js`。
- 修改：`test/lifecycle.test.js`——迁移为 Reference Provider lifecycle 回归，随后由 package test 替代并删除根测试。
- 修改：`scripts/verify-m0.ps1`、`scripts/verify-m1.ps1`——保留历史行为断言，移除与 M2 合法边界冲突的“零 dependency/zero Remote”实现假设。

## 2. 固定接口和状态契约

实现期间名称不得漂移：

```ts
export const WORKBENCH_SETTINGS_NAMESPACE = "dshEmbedded.workbench" as const;
export const WORKBENCH_REMOTE_NAMESPACE = "workbenchCapabilities" as const;
export const WORKBENCH_CONTRACT_VERSION = "1.0.0" as const;

export type CapabilityAvailability =
  | "AVAILABLE" | "MISSING" | "INCOMPATIBLE" | "BLOCKED";
export type CapabilityPhase =
  | "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" | "FAILED";
export type CapabilityApplyMode = "LIVE" | "RESTART_REQUIRED";
export type WorkbenchHealth = "READY" | "DEGRADED" | "FAILED";
export type CapabilityErrorStage =
  | "discover" | "import" | "compatibility" | "start"
  | "stop" | "cleanup" | "settings" | "remote";

export interface CapabilityErrorSnapshot {
  readonly code: string;
  readonly stage: CapabilityErrorStage;
  readonly message: string;
  readonly recoverable: boolean;
  readonly suggested_action: string;
  readonly occurred_at: string;
  readonly expected_version?: string;
  readonly actual_version?: string;
}

export interface CapabilitySnapshot {
  readonly capability_id: string;
  readonly display_name: string;
  readonly provider_version: string | null;
  readonly contract_version: string | null;
  readonly required: boolean;
  readonly desired_enabled: boolean;
  readonly availability: CapabilityAvailability;
  readonly phase: CapabilityPhase;
  readonly apply_mode: CapabilityApplyMode;
  readonly error: CapabilityErrorSnapshot | null;
  readonly revision: number;
  readonly updated_at: string;
}

export interface WorkbenchSnapshot {
  readonly health: WorkbenchHealth;
  readonly capabilities: readonly CapabilitySnapshot[];
}

export interface ProviderDescriptor {
  readonly capability_id: string;
  readonly package_name: string;
  readonly display_name: string;
  readonly required: boolean;
  readonly expected_provider_version: string;
  readonly supported_contract_major: number;
  readonly default_enabled: boolean;
}

export interface ProviderManifest {
  readonly capability_id: string;
  readonly display_name: string;
  readonly provider_version: string;
  readonly contract_version: string;
  readonly apply_mode: "LIVE";
}
```

Remote 固定签名：

```ts
list(): Promise<WorkbenchSnapshot>;
retry(capabilityId: string): Promise<CapabilitySnapshot>;
reconcile(capabilityId: string): Promise<CapabilitySnapshot>;
```

Settings 固定结构：

```ts
interface WorkbenchSettings {
  capabilities: Record<string, { enabled: boolean }>;
}
```

## 3. 实施任务

### 任务 1：建立 workspace、精确工具链和基线门禁

**文件：**
- 修改：`package.json`
- 创建：`package-lock.json`
- 创建：`.gitignore`
- 创建：`tsconfig.base.json`
- 创建：`tsconfig.json`
- 创建：`tsconfig.host.json`
- 创建：`tsconfig.client.json`
- 创建：`packages/workbench-contracts/package.json`、`tsconfig.json`
- 创建：`packages/workbench-core/package.json`、`tsconfig.json`
- 创建：`packages/workbench-ui/package.json`、`tsconfig.json`
- 创建：`packages/provider-reference/package.json`、`tsconfig.json`
- 创建：`test/workspace-contract.test.js`

- [ ] **步骤 1：运行 M1 基线并保存结果**

运行：

```powershell
npm test
npm run verify:m0
npm run verify:m1
git status --short --branch
```

预期：三项均退出 `0`；Git 仅包含已批准的 M2 文档变更，不包含产品代码变更。

- [ ] **步骤 2：编写 workspace 失败测试**

`test/workspace-contract.test.js` 必须断言：根包名不变、`workspaces` 精确为四个 package 目录、内部版本均为 `0.0.0`、所有 DSH 版本均为 `0.1.1-rc.2`、Cordis 为 `4.0.1`、Reference 只出现在 `optionalDependencies`。

```js
test("M2 keeps one bundle and four internal workspace packages", async () => {
  const root = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(root.name, "@dsh-embedded/dsh-embedded-workbench");
  assert.deepEqual(root.workspaces, [
    "packages/workbench-contracts",
    "packages/workbench-core",
    "packages/workbench-ui",
    "packages/provider-reference"
  ]);
  assert.equal(root.dependencies["@dsh-embedded/workbench-core"], "0.0.0");
  assert.equal(root.optionalDependencies["@dsh-embedded/provider-reference"], "0.0.0");
});
```

- [ ] **步骤 3：运行测试确认失败**

运行：`node --test test/workspace-contract.test.js`

预期：FAIL，首个差异为 `workspaces` 不存在。

- [ ] **步骤 4：加入最终 package 边界、workspace 与精确开发依赖**

先创建四个真实 package manifest 和 tsconfig，使 `npm install` 不依赖不存在的 workspace。包依赖固定如下：

| 包 | dependencies | peerDependencies |
|---|---|---|
| Contracts | 无 | 无 |
| Core | Contracts `0.0.0`、Schemastery `3.18.1`、Zod `4.4.3` | Cordis、Settings、Typert Protocol/Registry 均锁定本计划版本 |
| UI | Contracts `0.0.0` | Cordis、API Gateway、Client Runtime、Client UI Settings、React |
| Reference | Contracts `0.0.0` | Cordis `4.0.1` |

Core manifest 从此就声明 `./typert` 与 `./remote` 生成出口及对应 `files`；源码尚未生成时允许文件缺失，但任务 7 后构建和 pack 门禁必须要求它们存在。

`tsconfig.base.json` 使用 `baseUrl: "."`，并把四个内部 package name 精确映射到各自 `src/index.ts`；各 package tsconfig 通过 project references 保持 Contracts → Core/UI/Reference 的单向编译顺序。测试与 `--noEmit` 因此读取源码，不依赖尚未生成的 `lib/`。

根包的内部依赖必须是：

```json
{
  "workspaces": [
    "packages/workbench-contracts",
    "packages/workbench-core",
    "packages/workbench-ui",
    "packages/provider-reference"
  ],
  "dependencies": {
    "@dsh-embedded/workbench-contracts": "0.0.0",
    "@dsh-embedded/workbench-core": "0.0.0",
    "@dsh-embedded/workbench-ui": "0.0.0"
  },
  "optionalDependencies": {
    "@dsh-embedded/provider-reference": "0.0.0"
  }
}
```

根脚本固定为：

```json
{
  "scripts": {
    "build": "tsc -b && node scripts/generate-typert.mjs && node scripts/build-client.mjs",
    "test": "npm run test:root && npm run test --workspaces --if-present",
    "test:root": "node --test test/*.test.js",
    "verify:m2": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-m2.ps1",
    "verify:m2:runtime": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-m2-runtime.ps1",
    "prepack": "npm run build && npm run verify:m2"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "4.0.1",
    "@deepseek-ai/dsh-api-gateway": "0.1.1-rc.2",
    "@deepseek-ai/dsh-client-runtime": "0.1.1-rc.2",
    "@deepseek-ai/dsh-client-ui-settings": "0.1.1-rc.2",
    "@deepseek-ai/dsh-settings": "0.1.1-rc.2",
    "@deepseek-ai/dsh-typert-protocol": "0.1.1-rc.2",
    "@deepseek-ai/dsh-typert-registry": "0.1.1-rc.2",
    "@deepseek-ai/dsh-typert-generator": "0.1.1-rc.2",
    "@deepseek-ai/schemastery": "3.18.1",
    "@types/node": "26.4.0",
    "@types/react": "18.3.1",
    "esbuild": "0.28.2",
    "react": "18.2.0",
    "tsx": "4.23.12",
    "typescript": "6.0.3",
    "zod": "4.4.3"
  }
}
```

运行：`npm install --ignore-scripts`

预期：生成 `package-lock.json`，无 DSH rc.1 包进入直接依赖。

- [ ] **步骤 5：运行 workspace 测试并提交**

运行：`node --test test/workspace-contract.test.js`

预期：PASS。

```powershell
git add package.json package-lock.json .gitignore tsconfig*.json packages/*/package.json packages/*/tsconfig.json test/workspace-contract.test.js
git commit -m "build: establish M2 workspace toolchain"
```

### 任务 2：实现无框架泄漏的 Contracts 包

**文件：**
- 修改：`packages/workbench-contracts/package.json`
- 修改：`packages/workbench-contracts/tsconfig.json`
- 创建：`packages/workbench-contracts/src/index.ts`
- 创建：`packages/workbench-contracts/test/contracts.test.ts`

- [ ] **步骤 1：编写失败测试**

覆盖：Contract major 兼容、Provider 精确版本、非法版本拒绝、快照 JSON 序列化、深冻结、未知枚举值拒绝。

```ts
test("contract compatibility compares major before provider import", () => {
  assert.equal(isContractCompatible("1.0.0", 1), true);
  assert.equal(isContractCompatible("2.0.0", 1), false);
  assert.throws(() => isContractCompatible("not-semver", 1), /contract version/i);
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx tsx --test packages/workbench-contracts/test/contracts.test.ts`

预期：FAIL，模块 `../src/index.ts` 或导出不存在。

- [ ] **步骤 3：实现第 2 节固定类型与纯函数**

`isContractCompatible()` 只解析 `MAJOR.MINOR.PATCH`，不引入 Cordis、DSH、React 或 Provider 依赖。`freezeJsonSnapshot()` 先 `structuredClone()` 再递归冻结，拒绝 function、Promise、Error、symbol 和循环引用。

```ts
export function isContractCompatible(version: string, supportedMajor: number): boolean {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (match === null) throw new TypeError(`Invalid contract version: ${version}`);
  return Number(match[1]) === supportedMajor;
}
```

- [ ] **步骤 4：验证包边界**

运行：

```powershell
npx tsx --test packages/workbench-contracts/test/contracts.test.ts
npx tsc -p packages/workbench-contracts/tsconfig.json --noEmit
```

预期：PASS；`rg "cordis|dsh-|react|provider-reference" packages/workbench-contracts/src` 无匹配。

- [ ] **步骤 5：提交**

```powershell
git add packages/workbench-contracts
git commit -m "feat: define M2 capability contracts"
```

### 任务 3：把 M1 生命周期迁移为 Reference Provider 私有资源所有权

**文件：**
- 修改：`packages/provider-reference/package.json`
- 修改：`packages/provider-reference/tsconfig.json`
- 创建：`packages/provider-reference/src/lifecycle.ts`
- 创建：`packages/provider-reference/src/index.ts`
- 创建：`packages/provider-reference/test/provider.test.ts`

- [ ] **步骤 1：编写正常和故障 fixture 测试**

每个实例独立记录资源；fixture 配置只允许 `none/start/cleanup`，正式 Bundle 永远传 `none`。

```ts
test("two reference instances never share resources", async () => {
  const left = createReferenceLifecycle({ failure: "none" });
  const right = createReferenceLifecycle({ failure: "none" });
  await Promise.all([left.start(), right.start()]);
  assert.notEqual(left.snapshot().instance_id, right.snapshot().instance_id);
  await left.dispose();
  assert.equal(left.snapshot().remaining_resource_count, 0);
  assert.equal(right.snapshot().state, "RUNNING");
  await right.dispose();
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx tsx --test packages/provider-reference/test/provider.test.ts`

预期：FAIL，Reference 模块不存在。

- [ ] **步骤 3：迁移生命周期并固定 Provider manifest**

manifest 必须为：

```ts
export const manifest = Object.freeze({
  capability_id: "reference.lifecycle",
  display_name: "Reference Lifecycle",
  provider_version: "0.0.0",
  contract_version: WORKBENCH_CONTRACT_VERSION,
  apply_mode: "LIVE"
} satisfies ProviderManifest);
```

Provider `apply(ctx, config)` 创建一个 lifecycle，`await start()` 后返回唯一 disposer；资源获取后立即压栈，逆序清理，1000 ms 到期或清理异常均拒绝且保留残留诊断。

`packages/provider-reference/package.json` 同时发布 import 前可读的静态 manifest；代码导出的 `manifest` 必须与它逐字段相等：

```json
{
  "dshEmbedded": {
    "provider": {
      "capability_id": "reference.lifecycle",
      "display_name": "Reference Lifecycle",
      "provider_version": "0.0.0",
      "contract_version": "1.0.0",
      "apply_mode": "LIVE"
    }
  }
}
```

- [ ] **步骤 4：验证故障边界**

运行：

```powershell
npx tsx --test packages/provider-reference/test/provider.test.ts
npx tsc -p packages/provider-reference/tsconfig.json --noEmit
```

预期：正常、start failure rollback、cleanup failure、timeout、双实例隔离全部 PASS；无文件/进程/网络 API。

- [ ] **步骤 5：提交**

```powershell
git add packages/provider-reference
git commit -m "feat: add isolated reference provider"
```

### 任务 4：实现 Catalog 与 import 前兼容检查

**文件：**
- 修改：`packages/workbench-core/package.json`
- 修改：`packages/workbench-core/tsconfig.json`
- 创建：`packages/workbench-core/src/catalog.ts`
- 创建：`packages/workbench-core/src/provider-resolver.ts`
- 创建：`packages/workbench-core/test/catalog.test.ts`
- 创建：`packages/workbench-core/test/provider-resolver.test.ts`

- [ ] **步骤 1：编写 Catalog 失败测试**

断言 revision 单调递增、`updated_at` 由注入时钟产生、返回值深冻结、容量等于描述符数量、健康度只受已启用能力影响、一个 ID 的更新不改变其他 ID。

- [ ] **步骤 2：编写 Resolver 失败测试**

注入 `resolveManifest` 与 `importModule` Fake，并断言：MISSING/INCOMPATIBLE 时 `importModule` 调用次数为 `0`；包名、capability ID、provider version、contract major 全部匹配后才允许 import。

```ts
test("incompatible provider code is never imported", async () => {
  let imports = 0;
  const result = await resolveProvider(descriptor, {
    resolveManifest: async () => ({
      name: descriptor.package_name,
      version: "0.0.0",
      dshEmbedded: { provider: { ...manifest, contract_version: "2.0.0" } }
    }),
    importModule: async () => { imports += 1; return providerModule; }
  });
  assert.equal(result.availability, "INCOMPATIBLE");
  assert.equal(imports, 0);
});
```

- [ ] **步骤 3：实现 Catalog 和 Resolver**

Resolver 接收 Bundle 传入的 `packageBaseUrl`，使用 `createRequire(packageBaseUrl).resolve(descriptor.package_name + "/package.json")` + `readFile()` 获取安装 manifest。这样 pnpm 严格 node_modules 下从根 Bundle 的 Optional dependency 解析，而不是错误地从 Core package 自身解析。校验通过后再用同一个 anchored require 解析 package 主入口并 `import(pathToFileURL(entryPath).href)`；错误分别映射 `CAPABILITY_MISSING`、`CAPABILITY_MANIFEST_INVALID`、`CAPABILITY_PROVIDER_VERSION_MISMATCH`、`CAPABILITY_CONTRACT_INCOMPATIBLE`、`CAPABILITY_IMPORT_FAILED`。

import 完成后再次比较模块导出的 `manifest` 与磁盘静态 manifest；不一致映射 `CAPABILITY_MANIFEST_DRIFT`，不得创建 Fiber。

- [ ] **步骤 4：运行测试并提交**

```powershell
npx tsx --test packages/workbench-core/test/catalog.test.ts packages/workbench-core/test/provider-resolver.test.ts
git add packages/workbench-core
git commit -m "feat: add capability catalog and resolver"
```

### 任务 5：实现单能力 Operation Gate 与 Core Controller

**文件：**
- 创建：`packages/workbench-core/src/operation-gate.ts`
- 创建：`packages/workbench-core/src/controller.ts`
- 创建：`packages/workbench-core/test/operation-gate.test.ts`
- 创建：`packages/workbench-core/test/controller.test.ts`

- [ ] **步骤 1：编写并发失败测试**

覆盖：同一能力重复 reconcile 返回同一 in-flight Promise；快速 `true→false→true` 最终 RUNNING 且获取/清理成对；不同能力同时 STARTING；A 失败时 B RUNNING。

```ts
test("provider A failure does not stop provider B", async () => {
  const [a, b] = await Promise.allSettled([
    controller.reconcile("fixture.fail-start"),
    controller.reconcile("fixture.healthy")
  ]);
  assert.equal(a.status, "rejected");
  assert.equal(b.status, "fulfilled");
  assert.equal(controller.snapshot("fixture.fail-start").phase, "FAILED");
  assert.equal(controller.snapshot("fixture.healthy").phase, "RUNNING");
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx tsx --test packages/workbench-core/test/operation-gate.test.ts packages/workbench-core/test/controller.test.ts`

预期：FAIL，Gate/Controller 导出不存在。

- [ ] **步骤 3：实现独立 Gate**

每个 runtime entry 只持有一个 `drainPromise`、递增 `requestedGeneration`、当前 `fiber` 和最新 desired 读取函数。循环每轮读取最新 desired；同 ID 不并发，不同 ID 没有全局锁。

```ts
request(run: (generation: number) => Promise<CapabilitySnapshot>): Promise<CapabilitySnapshot> {
  const generation = ++this.requestedGeneration;
  if (this.drainPromise !== undefined) return this.drainPromise;
  this.drainPromise = this.drain(run, generation).finally(() => {
    this.drainPromise = undefined;
  });
  return this.drainPromise;
}
```

`CapabilityController.reconcile()` 和 `retry()` 不声明为 `async`，而是直接返回 Gate 的 Promise，确保重复调用拿到严格相同的 in-flight Promise；Remote Gateway 可以在边界处 `await` 它。

- [ ] **步骤 4：实现 Controller 状态迁移**

启动顺序：resolve manifest → compatibility → import → `ctx.plugin()` → `fiber.await()` → 再读 desired。启动期间被禁用时直接进入 STOPPING 并 dispose，不发布幽灵 RUNNING。停止时只调用该 Provider Fiber 的 `dispose()`；清理拒绝或 `uid !== null` 时设置 `FAILED + RESTART_REQUIRED`，禁止本地 retry。

Core 初次启动使用：

```ts
await Promise.allSettled(
  descriptors.map((descriptor) => controller.reconcile(descriptor.capability_id))
);
```

- [ ] **步骤 5：运行测试并提交**

```powershell
npx tsx --test packages/workbench-core/test/operation-gate.test.ts packages/workbench-core/test/controller.test.ts
git add packages/workbench-core/src packages/workbench-core/test
git commit -m "feat: supervise providers with isolated operation gates"
```

### 任务 6：注册 Settings 唯一事实源并驱动差量 reconcile

**文件：**
- 创建：`packages/workbench-core/src/settings.ts`
- 创建：`packages/workbench-core/test/settings.test.ts`

- [ ] **步骤 1：编写 Settings 失败测试**

Fake 必须复现 rc.2 `register().get/watch/update/replace` 契约。断言默认值来自描述符、一次变更只协调变化 ID、revision 冲突不覆盖新值、普通 dispose 注销 runtime scope 但不清持久文档。

- [ ] **步骤 2：运行测试确认失败**

运行：`npx tsx --test packages/workbench-core/test/settings.test.ts`

预期：FAIL，Settings owner 不存在。

- [ ] **步骤 3：实现 schema 与 watcher**

```ts
const WorkbenchSettingsSchema = z.object({
  capabilities: z.dict(z.object({ enabled: z.boolean() })).default({})
});

const scope = ctx.settings.register(
  settingsNamespace(WORKBENCH_SETTINGS_NAMESPACE),
  WorkbenchSettingsSchema,
  { base: { capabilities: defaultsFrom(descriptors) } }
);
```

Watcher 比较前后 `enabled`，只为变化 ID 调用一次 `controller.reconcile(id)`；watcher 错误转成该能力 `settings` 阶段错误，不停止其他能力。

- [ ] **步骤 4：验证并提交**

```powershell
npx tsx --test packages/workbench-core/test/settings.test.ts
git add packages/workbench-core/src/settings.ts packages/workbench-core/test/settings.test.ts
git commit -m "feat: persist capability desired state"
```

### 任务 7：实现 Typert Gateway、生成物和 Core 组合根

**文件：**
- 创建：`packages/workbench-core/src/gateway.ts`
- 创建：`packages/workbench-core/src/index.ts`
- 创建：`packages/workbench-core/test/gateway.test.ts`
- 创建：`scripts/generate-typert.mjs`
- 修改：`packages/workbench-core/package.json`

- [ ] **步骤 1：编写 Gateway 失败测试**

断言 namespace 精确为 `workbenchCapabilities`；未知 ID 拒绝且不调用 Controller；cleanup 残留能力的 retry 拒绝；list 返回深冻结快照。

- [ ] **步骤 2：实现三个 Remote 方法**

```ts
export class WorkbenchCapabilitiesGateway extends TypertRemoteService {
  constructor(ctx: Context, private readonly controller: CapabilityController) {
    super(ctx, WORKBENCH_REMOTE_NAMESPACE);
  }

  @Remote("list")
  async list(): Promise<WorkbenchSnapshot> {
    return this.controller.snapshotAll();
  }

  @Remote("retry")
  async retry(capabilityId: string): Promise<CapabilitySnapshot> {
    return this.controller.retry(capabilityId);
  }

  @Remote("reconcile")
  async reconcile(capabilityId: string): Promise<CapabilitySnapshot> {
    return this.controller.reconcile(capabilityId);
  }
}
```

- [ ] **步骤 3：实现 Core 组合与逆序释放**

创建顺序固定为 Catalog → Controller → Settings owner → Gateway → initial allSettled reconcile；释放顺序为停止 Settings watcher → 分别停止所有 Provider → 释放 Gateway/Core Fiber。任一 Provider cleanup 失败只进入汇总错误，不跳过其他 Provider。

- [ ] **步骤 4：生成严格 Typert 产物**

`scripts/generate-typert.mjs` 必须调用：

```js
const generator = new WorkspaceTypertGenerator(projectRoot);
const artifacts = generator.generate(
  ["@dsh-embedded/workbench-core"],
  ["host"]
);
```

对每个 artifact 写入 `lib/typert.host.js`、`lib/typert.host.d.ts`；存在 `artifact.remote` 时同时写 `lib/typert.remote-client.js`、`.d.ts`、`.d.ts.map`。脚本断言恰好一个 Host artifact 且包含 `list/retry/reconcile`。

- [ ] **步骤 5：验证生成结果**

运行：

```powershell
npx tsc -b
node scripts/generate-typert.mjs
node -e "import('./packages/workbench-core/lib/typert.host.js').then(m => console.log(m.TYPERT.invocations.map(x => x.method)))"
```

预期：输出包含且仅包含 `list,retry,reconcile`；生成 schema 为 strict；未知字段的 Host 调用测试返回校验失败。

- [ ] **步骤 6：提交**

```powershell
git add packages/workbench-core scripts/generate-typert.mjs tsconfig*.json
git commit -m "feat: expose typed capability remote gateway"
```

### 任务 8：把根包收敛为 Bundle 和 Host/Client 装配层

**文件：**
- 修改：`src/index.js`
- 创建：`src/providers.js`
- 创建：`src/client-entry.js`
- 创建：`scripts/build-client.mjs`
- 修改：`package.json`
- 修改：`test/backend.test.js`
- 修改：`test/package-contract.test.js`

- [ ] **步骤 1：先改测试表达 M2 Bundle 契约**

断言根包：只有一个 Loader row；required 内部包在 `dependencies`；Reference 只在 `optionalDependencies`；`src/providers.js` 不 import Provider；Host 只注册生成 Typert contribution 并创建一个 Core Fiber；Client 只挂载生成 Remote descriptor。

- [ ] **步骤 2：运行测试确认失败**

运行：`node --test test/backend.test.js test/package-contract.test.js`

预期：FAIL，仍观察到 M1 lifecycle 和 M0 Client section。

- [ ] **步骤 3：实现唯一 Provider 描述符**

```js
export const PROVIDERS = Object.freeze([Object.freeze({
  capability_id: "reference.lifecycle",
  package_name: "@dsh-embedded/provider-reference",
  display_name: "Reference Lifecycle",
  required: false,
  expected_provider_version: "0.0.0",
  supported_contract_major: 1,
  default_enabled: true
})]);
```

- [ ] **步骤 4：实现 Host 装配**

`src/index.js` 导出 `inject = ["typert"]`，从 `@dsh-embedded/workbench-core/typert` 导入 `TYPERT`，调用公开 seam `ctx.typert.register(TYPERT)`；随后 `ctx.plugin(core, { providers: PROVIDERS, packageBaseUrl: import.meta.url })` 并 `await fiber.await()`。`packageBaseUrl` 只用于从 Bundle 依赖树定位 Optional package，不进入 Capability snapshot。失败时先 dispose Core Fiber，再撤销 Typert registration；正常 disposer 也按该逆序执行。

- [ ] **步骤 5：实现 Client Remote 装配和 ModuleLoader 构建**

`src/client-entry.js`：

```js
import workbenchRemote from "@dsh-embedded/workbench-core/remote";

export const inject = ["remote"];
export async function apply(ctx) {
  return ctx.remote.$mount(workbenchRemote);
}
```

`scripts/build-client.mjs` 用 esbuild `bundle:true, format:"cjs", platform:"browser"` 生成内存输出，再包入：

```js
window.__ModuleLoader__.load({
  id: "@dsh-embedded/dsh-embedded-workbench",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    // esbuild CommonJS body
    return module.exports;
  }
});
```

产物写 `lib/client.js`；不得写全局 listener、WebSocket 或 EventEmitter。

根 manifest 的 DSH Client 组合固定为：

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": [
        "@deepseek-ai/dsh-api-gateway",
        "@dsh-embedded/workbench-ui"
      ],
      "platform": "web"
    }
  }
}
```

UI manifest 的 Client inject 固定包含 `@deepseek-ai/dsh-api-gateway`、`@deepseek-ai/dsh-client-runtime` 和 `@deepseek-ai/dsh-client-ui-settings`，版本均为 rc.2；UI 的 Cordis `inject` 再等待 `remote.workbenchCapabilities`，因此 UI 不会早于 Bundle Remote mount 执行业务 apply。

- [ ] **步骤 6：验证并提交**

```powershell
npm run build
node --test test/backend.test.js test/package-contract.test.js
git add src package.json package-lock.json scripts/build-client.mjs test/backend.test.js test/package-contract.test.js
git commit -m "refactor: compose M2 workbench bundle"
```

### 任务 9：实现 UI Controller 的状态同步与有界轮询

**文件：**
- 修改：`packages/workbench-ui/package.json`
- 修改：`packages/workbench-ui/tsconfig.json`
- 创建：`packages/workbench-ui/src/controller.ts`
- 创建：`packages/workbench-ui/test/controller.test.ts`

- [ ] **步骤 1：编写刷新和资源清理失败测试**

使用 fake clock，断言：页面打开调用一次 list；Settings 写完、retry/reconcile、`connection/reset` 后各刷新一次；仅 STARTING/STOPPING 每 500 ms 轮询，最多 20 次；稳定态和 dispose 后 timer 数为 0。

- [ ] **步骤 2：编写设置写入与 reset 测试**

`setEnabled(id, value)` 从最新 scope snapshot 克隆整个 `capabilities` 字段，只改目标 ID，再调用 `scope.set("capabilities", next)`；写入完成后调用单 ID reconcile。`reset()` 经确认后调用 `scope.unset("capabilities")`，M2 因 namespace 只有该字段而等价于清除 Workbench namespace，不影响其他 namespace。

- [ ] **步骤 3：运行测试确认失败**

运行：`npx tsx --test packages/workbench-ui/test/controller.test.ts`

预期：FAIL，UI Controller 不存在。

- [ ] **步骤 4：实现 Controller**

固定常量：

```ts
const TRANSIENT_PHASES = new Set(["STARTING", "STOPPING"]);
const POLL_INTERVAL_MS = 500;
const POLL_LIMIT = 20;
```

Controller 只保存当前 snapshot、loading/error、一个 timeout handle 和订阅集合；不保存历史列表。Remote 返回 `{ ok, value/error }` 时必须先判 `ok`。dispose 清 scope subscription、connection reset disposer 和 timeout，并等待正在进行的 refresh/write settle。

rc.2 `SettingsScopeController.set/unset` 会在写入失败时恢复镜像而不把冲突继续抛给调用者；因此写入完成后必须重读 scope snapshot 并核对目标值。目标未提交时保留 Host 最新值、显示 `settings` 阶段错误，禁止以 UI 草稿覆盖它。

- [ ] **步骤 5：验证并提交**

```powershell
npx tsx --test packages/workbench-ui/test/controller.test.ts
git add packages/workbench-ui
git commit -m "feat: synchronize workbench capability settings"
```

### 任务 10：实现 Settings UI、持续错误与安全启停提示

**文件：**
- 创建：`packages/workbench-ui/src/client.tsx`
- 创建：`packages/workbench-ui/test/client.test.tsx`
- 修改：`scripts/build-client.mjs`
- 修改：`test/client.test.js`

- [ ] **步骤 1：编写组件失败测试**

断言 section id 仍为 `dsh-embedded-workbench`；每项显示 desired、availability、phase、apply mode；不可用错误在 rerender 后持续存在；只读 Settings 禁用开关；`RESTART_REQUIRED` 明示“需要重启”；retry 只携带当前 capability ID；reset 必须先调用确认函数。

- [ ] **步骤 2：运行测试确认失败**

运行：`npx tsx --test packages/workbench-ui/test/client.test.tsx`

预期：FAIL，Settings UI 未实现。

- [ ] **步骤 3：实现 Client plugin 和视图**

Client inject 固定为：

```ts
export const inject = [
  "slots",
  "settingsScope",
  "remote",
  "remote.workbenchCapabilities"
];
```

apply 中绑定：

```ts
const scope = ctx.settingsScope.bind({
  namespace: WORKBENCH_SETTINGS_NAMESPACE
});
```

注册 `ctx.on("connection/reset", refresh)`；Settings section 使用原 id/label/order。错误卡必须显示 `capability_id`、`stage`、`message`、期望/实际版本和 `suggested_action`。LIVE 且可恢复时按钮立即 reconcile；清理失败和 restart required 时禁用原地 retry。

- [ ] **步骤 4：构建 UI 独立 ModuleLoader 包**

esbuild 把 `packages/workbench-ui/src/client.tsx` 构建到 `packages/workbench-ui/lib/client.js`，ModuleLoader id 为 `@dsh-embedded/workbench-ui`；仅 externalize `react` 与 `react/jsx-runtime`，Contracts 代码内联，禁止依赖 Core 私有模块。

- [ ] **步骤 5：验证并提交**

```powershell
npm run build
npx tsx --test packages/workbench-ui/test/controller.test.ts packages/workbench-ui/test/client.test.tsx
node --test test/client.test.js
git add packages/workbench-ui scripts/build-client.mjs test/client.test.js
git commit -m "feat: add isolated capability settings UI"
```

### 任务 11：执行一次安装分发阻断门

**文件：**
- 创建：`scripts/verify-m2.ps1`
- 创建：`test/runtime/local-registry.mjs`
- 创建：`scripts/verify-m2-runtime.ps1`
- 创建：`test/runtime/m2-install.test.js`

- [ ] **步骤 1：先建立无递归的静态 pack 前置门**

实现 `scripts/verify-m2.ps1` 的 package/exports/files、依赖方向、Typert 三方法、唯一 namespace 和零 Tool 检查。它只读取 manifest 与构建产物，不调用 `npm pack`，保证根 `prepack` 可被后续 registry fixture 安全调用。

- [ ] **步骤 2：编写本地 registry fixture 测试**

fixture 仅绑定 `127.0.0.1` 随机端口，服务五个 `npm pack` tarball 的 metadata/tarball；请求其他 package 返回 404。registry 在测试结束后关闭，tarball 和隔离 `DSH_HOME` 位于测试临时目录。

- [ ] **步骤 3：验证 required + optional 正常安装**

`verify-m2-runtime.ps1` 使用本机 rc.2：

```powershell
$env:DSH_HOME = $isolatedDshHome
$env:DSH_M2_REGISTRY_URL = $registryUrl
$env:NPM_CONFIG_USERCONFIG = $isolatedNpmrc
& $nodeExe $dshBin plugin --profile m2-isolated add `
  '@dsh-embedded/dsh-embedded-workbench@0.0.0' `
  --ignore-scripts
```

`$isolatedNpmrc` 只把 `@dsh-embedded` scope 指向 `$registryUrl`，默认 registry 保持 `https://registry.npmjs.org/`，避免本地 fixture 冒充或代理官方 DSH packages：

```ini
@dsh-embedded:registry=${DSH_M2_REGISTRY_URL}
registry=https://registry.npmjs.org/
```

预期：命令退出 `0`；profile 依赖只包含用户添加的 Bundle；lockfile 解析到 required 三包和 Optional Reference；用户只执行一次 add。

- [ ] **步骤 4：验证 Optional 缺失仍安装**

重新创建隔离 profile，registry 不发布 Reference metadata，重复同一条 add 命令。

预期：命令退出 `0`；Bundle、Contracts、Core、UI 存在；Reference 不存在；Workbench Host 启动并返回 `MISSING + STOPPED + DEGRADED`。

- [ ] **步骤 5：验证 remove 与设置保留**

在隔离的 `$isolatedDshHome/settings.yaml` 中写入 namespace `dshEmbedded.workbench`，其 `capabilities` map 使用完整键 `"reference.lifecycle"` 且 `enabled: false`，执行：

```powershell
& $nodeExe $dshBin plugin --profile m2-isolated remove `
  '@dsh-embedded/dsh-embedded-workbench'
```

预期：Bundle row/package/runtime 资源消失；其他 profile package/hash 不变；Workbench namespace 内容仍存在。重装后 desired 恢复为 false。

- [ ] **步骤 6：执行阻断判定**

运行：`npm run verify:m2:runtime`

预期：输出单行 JSON，`install_one_command=true`、`optional_missing_degraded=true`、`settings_preserved=true`、`other_profile_hash_unchanged=true`。

若 Optional 缺失场景退出非零，立即停止，不提交替代实现，按第 0 节回到 Spec。

- [ ] **步骤 7：通过后提交**

```powershell
git add test/runtime/local-registry.mjs test/runtime/m2-install.test.js scripts/verify-m2.ps1 scripts/verify-m2-runtime.ps1
git commit -m "test: verify one-command M2 distribution"
```

### 任务 12：完成 rc.2 隔离、回归、零 Tool 和资源验证

**文件：**
- 修改：`scripts/verify-m2.ps1`
- 创建：`test/m2-isolation.test.js`
- 修改：`scripts/verify-m0.ps1`
- 修改：`scripts/verify-m1.ps1`
- 修改：`test/cordis-host.test.js`
- 修改：`test/tool-snapshot.test.js`
- 删除：`test/lifecycle.test.js`
- 删除：`src/workbench-lifecycle.js`
- 删除：`src/client.js`

- [ ] **步骤 1：编写真实 Cordis 多 Provider 隔离测试**

同一个 Core 下挂健康 fixture 与启动失败 fixture，使用真实 Cordis 4.0.1。断言健康 Fiber ACTIVE、失败项 FAILED、Core Fiber ACTIVE；随后制造 cleanup failure，Core 仍逐项 dispose，健康项资源归零。

- [ ] **步骤 2：补齐静态 verify:m2**

`verify-m2.ps1` 必须检查：五包身份/版本、根包单 row、Provider 零互依赖、Core/UI 不 import Provider 私有路径、generated Typert 三方法、设置 namespace 唯一、无 `defineTool/ctx.tools/registerTool`、无循环 timer、声明的 pack 文件全部存在。该脚本不得调用 `npm pack`，避免被根 `prepack` 递归触发；真实 pack 清单由步骤 4 单独验证。

- [ ] **步骤 3：修订 M0/M1 回归门**

M0 保留：唯一 Loader row、唯一 Settings section、零 Tool、精确卸载。M1 保留：每 Fiber 一个 lifecycle、逆序清理、失败回滚、幂等、超时诊断；断言位置改为 Reference Provider，不再要求根包零 dependency 或零 Remote。

- [ ] **步骤 4：运行完整自动验证**

```powershell
npm run build
npm test
npm run verify:m0
npm run verify:m1
npm run verify:m2
npm run verify:m2:runtime
npm pack --dry-run --json
git diff --check
```

预期：全部退出 `0`；pack 包含根 `lib/client.js`、Cordis patch；内部包各自 pack 包含声明的 `lib` 与 Core Typert 产物；无额外 Tool。

- [ ] **步骤 5：人工 UI 验收**

在隔离 Web profile 逐项观察：默认 RUNNING；关闭后立即 STOPPED；打开后立即 RUNNING；缺失/不兼容/启动失败持续显示“能力不可用”；cleanup failure 显示“需要重启”；只读 Settings 禁用开关；reset 弹出确认并只清 Workbench namespace。

预期证据只标记 Desktop rc.2 runtime/UI；不得标记硬件、目标板、串口或调试器验证。

- [ ] **步骤 6：最终提交**

```powershell
git add package.json package-lock.json scripts test src packages .gitignore tsconfig*.json
git diff --cached --check
git commit -m "feat: complete M2 isolated capability workbench"
```

## 4. Spec 覆盖映射

| Spec 验收 | 实现任务 |
|---|---|
| V-M2-01/V-M2-02 包边界与依赖方向 | 任务 1、2、8、12 |
| V-M2-03 import 前兼容 | 任务 2、4 |
| V-M2-04/V-M2-05/V-M2-15 故障与清理隔离 | 任务 3、5、12 |
| V-M2-06 缺失 Provider | 任务 4、11 |
| V-M2-07 并发快速切换 | 任务 5 |
| V-M2-08 手动重试、无循环自动重试 | 任务 5、7、9 |
| V-M2-09 Settings 持久化、冲突、重置 | 任务 6、9、11 |
| V-M2-10 Typert strict schema | 任务 7、8 |
| V-M2-11 Client 刷新与 timer 清理 | 任务 9、10 |
| V-M2-12/V-M2-13 一次安装与 Optional 缺失 | 任务 11 |
| V-M2-14 真实 Fiber 启停 | 任务 5、12 |
| V-M2-16 Settings UI | 任务 9、10、12 |
| V-M2-17 精确卸载与设置保留 | 任务 11、12 |
| V-M2-18 零 Tool | 任务 12 |
| V-M2-19 有界状态/无遗留 timer | 任务 2、3、4、9、12 |
| V-M2-20 历史延期边界 | 任务 12 的证据声明，不宣称关闭 M1 顶层 reload |

## 5. 内存、资源与并发约束

- M2 不创建 RTOS Task、Queue、Semaphore、ISR、DMA 或硬件 buffer；对应目标板证据为 `not_applicable`。
- Catalog 容量固定为 Bundle 描述符数量；每能力只保存一个当前 snapshot、一个 Gate、一个 Fiber 引用和一个 in-flight Promise。
- UI 只保存一个最新 Workbench snapshot；无状态历史、日志历史或无界缓存。
- Provider 获取资源后立即登记 disposer，逆序释放；Fiber 是资源所有权边界，Core 不越权释放 Provider 内部对象。
- 同一能力操作由独立 Gate 串行；不同能力没有共享全局锁。JS Promise 不等于线程互斥，所有跨 await 状态都用 generation 再校验。
- UI 最多一个 500 ms timeout，最多 20 次；稳定态、组件卸载、Client Fiber dispose 时必须取消。
- Settings watcher、Remote mount、slot registration、connection listener 和 timer 都必须返回或登记对称 disposer。
- cleanup timeout 只结束主等待链；晚到 Promise 必须被观察，不能产生 unhandled rejection 或终态复活。

## 6. 回滚与证据边界

- 每个任务独立提交；失败优先 revert 当前任务提交，不重写 M0/M1 历史。
- M2 整体回滚锚点为 Plan 提交后的执行基线；恢复根 `package.json/src/test/scripts` 并删除四个 workspace 包、生成脚本和 M2 runtime fixture。
- `npm run build` 产生的 `lib/`、临时 registry tarball、隔离 `DSH_HOME` 和 `artifacts/m2/` 均为可再生数据，不纳入源码提交。
- 删除隔离目录前必须解析绝对路径并确认位于本轮临时根；不得删除当前用户 `%DSH_HOME%`、workspace root 或其他 profile。
- 自动证据分为静态、Node 主机、真实 Cordis、DSH rc.2 runtime、UI 人工；不得将其中任一项外推为硬件完成。
- 当前计划不推送远端、不发布 npm/市场版本、不操作用户真实 Desktop profile。

## 7. Plan 完成后的门禁

执行者完成任务 1～12 后，必须把代码和验证结果交给 `mcu-workbench:workflow-final-review`。任何改变以下事实的实现都退回 Spec：

- 单 Bundle + 多能力插件；
- required Core/UI 与 Optional Provider；
- Settings 是 desired 唯一事实源；
- Remote 只提供 list/retry/reconcile；
- 兄弟 Provider 故障隔离；
- 无自造总线、无循环自动重试；
- 普通卸载保留设置、显式确认才重置；
- M2 只有 Reference Provider，无真实硬件能力。
