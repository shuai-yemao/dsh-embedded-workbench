# T-005 执行记录

| 字段 | 内容 |
|---|---|
| allocation_id | `T-005-20260826T214344+0800` |
| primary_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| primary_implementation_skill | `mcu-workbench:tdd` |
| supporting_skills | `mcu-workbench:tools-verification` |
| project_root/cwd | `D:\zhuomian\dsh-embedded-workbench` |
| spec_version | `v0.1` |
| status | `pass` |

## 施工前边界

- observer 只在 `test/runtime` 存在，绝不进入根 package 的 exports/files/dsh bundle。
- observer 可为测试注入 `tools`，但只读取 `ctx.tools.schemas()`，不得调用 `register` 或产品 Tool API。
- baseline patch 只禁用目标 row；candidate 保持目标 row 启用；两者均加载 observer。

## 测试先行记录

- 命令：`cwd=D:\zhuomian\dsh-embedded-workbench; node --test test/tool-snapshot.test.js`。
- 预期失败：observer fixture 尚不存在。
- 实际：exit 1，0/2，`ERR_MODULE_NOT_FOUND` 指向 `test/runtime/tool-snapshot/index.js`。
- 证据等级：`host`。

## 实现与验证

- 新增：`test/runtime/tool-snapshot/package.json`、`index.js`、`cordis.patch.yml`、`baseline.disable-target.patch.yml`、`test/tool-snapshot.test.js`。
- 补强：根 `package.json` 与 `test/package-contract.test.js`，测试入口固定为 `node --test test/*.test.js`，不自动发现 runtime fixture。
- observer tests：exit 0，2/2。
- `npm test`：exit 0，10/10。
- `npm run pack:dry-run`：exit 0，根包仍仅有 4 个批准文件，未包含 observer/test/scripts/state。
- `node --check test/runtime/tool-snapshot/index.js`：exit 0。
- 行尾空白：无命中。

## SHA-256

- `test/tool-snapshot.test.js`：`5BC19F9F66007BEC249F8567491F2D72F84721E7DFA816F8E97DADC1EB8CD3F1`
- `test/runtime/tool-snapshot/package.json`：`AB45A0B0369C91B069706CA2A893F95327ABB87EEA13A6F98F35A22540078F3C`
- `test/runtime/tool-snapshot/index.js`：`A95E7F91E8A8D47FA01279F43266EE372AAAFFE991C99F887E3D5F2A2D083DEC`
- `test/runtime/tool-snapshot/cordis.patch.yml`：`DD48BF51B8F6A246A597D03EFCCD005DC5EB82C336D5057D7ADF8AC6FE0A3053`
- `test/runtime/tool-snapshot/baseline.disable-target.patch.yml`：`31D569ACFBA0ABF78AF8D0B03410E450E12E10936F6203CA9D2D10C63AE2E0F6`

## 后续契约修订

- rc.1 `dsh plugin` 源码确认 bundleless dependency 不会加入 `dsh.profile.bundles`，而 `--patch` 在 profile 层之后显式挂载 observer。
- 因此移除了 fixture 自身的 `dsh.bundle`；当前 `package.json` SHA-256 为 `D741BE7E873B0F70E59B4CE970D77B95EDE1CCB9829DEB38E05AFE689BA67388`。
- `test/tool-snapshot.test.js` 同步断言 `fixtureManifest.dsh === undefined`；当前 SHA-256 为 `619CBF6E8BE25F49F7E5766387D30CEF946EC6ED592A2C4111C4B03D88BE0CF0`。
- 回归：observer 2/2、全量 `npm test` 10/10、root pack 4 文件均通过；toolchain-engineer 复核通过。

## 审查与 SOLID

- system-architect：通过；确认 observer 的 tools 注入没有泄漏到产品，且无状态、无资源。
- toolchain-engineer：通过；确认两份 overlay 可由 rc.1 parser 解析、ESM/peer 兼容及根包排除。
- solid_status：`pass`。
- 未验证：真实 rc.1 baseline/candidate 的实际工具集合及集合差，留给 T-006/T-007。
