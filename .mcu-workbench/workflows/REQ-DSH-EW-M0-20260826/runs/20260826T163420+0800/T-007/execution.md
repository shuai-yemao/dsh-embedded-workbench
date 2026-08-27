# T-007 执行记录

| 字段 | 内容 |
|---|---|
| allocation_id | `T-007-20260826T220206+0800` |
| primary_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| primary_implementation_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:tdd` |
| project_root/cwd | `D:\zhuomian\dsh-embedded-workbench` |
| inherited_pid | `85444` |
| status | `pass` |

## 施工前边界

- baseline 与 candidate 只改变目标 row 的 enable 状态，observer overlay、profile、preset、Desktop rc.1 和其他环境保持一致。
- `tools.schemas()` 的 JSON 快照是唯一运行态集合依据；静态扫描只作辅助。
- 两个采样进程串行启动/停止；不会复用 PID 85444 的非 observer 启动结果作为集合证据。

## 失败检查与实现

- 先执行 `node --test test/verify-m0.test.js`：新增的相同集合/额外工具 fixture 在 verifier 尚不接受 `-BaselineTools`、`-CandidateTools` 时失败（4 pass / 2 fail），确认缺少 exact set diff 合约。
- 在 `scripts/verify-m0.ps1` 实现只读快照读取、marker/名称唯一性校验和 exact set diff；其后同一测试为 6/6 pass。
- 最终全量 `npm test` 为 12/12 pass；`npm run pack:dry-run` 仅含 `cordis.patch.yml`、`package.json`、`src/client.js`、`src/index.js` 四个产品文件。

## 运行态采样

- 先有界停止 T-006 遗留的已记录 PID `85444`，避免复用其非 observer 启动结果。
- baseline 首次因 rc.1 CLI 选项顺序错误（`--patch` 位于 `--no-open` 后）返回 `unknown option '--patch'`，未启动服务；保留日志后将 `--patch` 前置，作为一次已定位重试。
- 修正后的 baseline：PID `90900`、端口 `32769`，observer marker 一次、目标 Host marker 0、stderr 0；读取快照后精确停止。
- candidate：PID `92100`、端口 `44527`，observer marker 一次、目标 Host marker 1、stderr 0；读取快照后精确停止。
- `baseline-tools.json` 与 `candidate-tools.json` 都为 `tools=[]`；`tool-diff.json` 的 added/removed 均为空，raw/unique count 均为 0。

## 产物哈希

| 文件 | SHA-256 |
|---|---|
| `baseline-tools.json` | `B37F30BB0D4A451C4B57098022E3D2CB2521F479417844FB2987B89EF0E6096E` |
| `candidate-tools.json` | `A15878DE2C93215E2B6FB81B53281C1CB19770A770BEF5CF1CFD9E2959602DEF` |
| `baseline.stdout.log` | `2125398E53ACBF53C8288311788FD807B86F3C369C3922344BB82309F7325B3B` |
| `baseline-retry.stdout.log` | `497537AFF11E84F6A0CFD4BC546F82703B3C311C499A3F5F44C93CF4EDC0F78C` |
| `candidate.stdout.log` | `30C446D2200808A12E080E9FA352535EB91F7CEBC1F56A8788EA8851FF8624D4` |

## 复核与结论

- toolchain-engineer：PASS。确认 observer bundleless/只读、两侧仅目标 row enable 状态不同、有效 PID/端口均已停止、exact set diff 为空。
- system-architect：PASS。确认满足 V-M0-02、V-M0-09，并保持 Desktop rc.1 runtime、Settings UI 与回滚等证据边界。
- 结论：T-007 `pass`；详见 `review.md`、`runtime-summary.md` 和 `tool-diff.json`。
