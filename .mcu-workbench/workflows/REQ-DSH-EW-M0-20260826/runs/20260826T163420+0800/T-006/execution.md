# T-006 执行记录

| 字段 | 内容 |
|---|---|
| allocation_id | `T-006-20260826T214855+0800` |
| primary_agent | `toolchain-engineer` |
| support_agents | `verification-engineer` |
| primary_implementation_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:workflow-ai-collab` |
| project_root/cwd | `D:\zhuomian\dsh-embedded-workbench` |
| isolated_dsh_home | `D:\zhuomian\dsh-embedded-workbench\.mcu-workbench\runtime\20260826T163420+0800\dsh-home` |
| status | `pass` |

## 保护边界

- 当前用户 profile：`C:\Users\zhang\AppData\Roaming\dsh-desktop\harness\profiles\web`，仅读取并记录 `package.json`、`pnpm-lock.yaml` SHA-256。
- 官方 runtime：`F:\DSH Desktop\resources\app\node_modules`，仅执行 bundled Node/DSH，不修改文件。
- 所有 Profile、依赖、lock 和运行日志写入仅允许位于 `isolated_dsh_home`。

## 安装、组合与运行态验证

- 官方 `plugin --profile web add file:D:/zhuomian/dsh-embedded-workbench`：exit 0，初始化隔离 profile 并加入目标 bundle。
- 官方 `plugin --profile web add file:D:/zhuomian/dsh-embedded-workbench/test/runtime/tool-snapshot`：exit 0；fixture 是 bundleless dependency，不加入 bundles。
- `--dump-config`：exit 0；完整输出为 `dump-config.txt`，目标 row/name 各一次，observer row 为零。
- Web：Desktop Node PID `85444`，仅监听 `127.0.0.1:6384`；marker 恰好一次且 stderr 为空。
- HTTP：`/` 为 200 且含 `__DSH_BOOT__`；`/plugins/@dsh-embedded/dsh-embedded-workbench/client.js` 为 200，内容 SHA-256 与本地 client 一致。
- 保护 profile 前后 SHA-256 写入 `protected-profile-hashes.md`，两个受保护文件均 unchanged。
- 未验证：Desktop 窗口、Settings UI 人工可见性和工具集合差不由本任务声明。

## 证据归档与审查

- `dump-config.txt` SHA-256：`0239C306F54B3D0438BB40D2DB0844E93A27E8020A3638D89EBEFF74228AE574`。
- `protected-profile-hashes.md` SHA-256：`19EAF7C29AB82A8D865D1D57EA9F341603571B18D250F92FC4D57E754AB92812`。
- `runtime-summary.md` SHA-256：`FA9641DB23AD0957C11C964D6EF62A1B9796A50D00035ACFC95B85884AEBFBA1`。
- system-architect 与 toolchain-engineer 均复核通过。
- PID `85444` 由 T-007 接管以采集两次工具集合；T-009 必须有界停止并补写最终日志哈希。
