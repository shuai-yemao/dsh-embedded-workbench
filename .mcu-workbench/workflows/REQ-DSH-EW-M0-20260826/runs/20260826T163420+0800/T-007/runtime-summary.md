# T-007 Desktop rc.1 运行态工具集合对比

## 固定比较边界

- 隔离运行时：`D:\zhuomian\dsh-embedded-workbench\.mcu-workbench\runtime\20260826T163420+0800\dsh-home`。
- DSH：Desktop bundled `0.1.1-rc.1`；Node：Desktop bundled `v24.9.0`。
- 两次均加载同一 bundleless observer overlay、同一隔离 profile、同一预设与同一环境；唯一变化是 baseline overlay 禁用 `dsh-embedded-workbench` 目标 row。
- observer 只调用 `ctx.tools.schemas()` 并输出排序后的工具名，不注册工具。

## 串行运行记录

| 阶段 | PID/端口 | observer 快照 | 目标 Host marker | stderr | 停止结果 |
|---|---|---|---:|---:|---|
| baseline（首次） | 无服务 | 命令行在 `--no-open` 后传入 `--patch`，rc.1 返回 `unknown option '--patch'` | 0 | 1 条 CLI 错误 | 未启动；作为已定位的一次命令顺序重试保留 |
| baseline（修正） | `90900` / `32769` | `baseline-tools.json`，空集合 | 0 | 0 | 已按记录 PID 停止，确认退出 |
| candidate | `92100` / `44527` | `candidate-tools.json`，空集合 | 1 | 0 | 已按记录 PID 停止，确认退出 |

修正后的命令把两个 `--patch` 放在 `web` 子命令选项之前；未改变 profile、preset、observer 或目标包内容。所有两个成功采样进程均串行运行并已停止；检查时不存在遗留的 Desktop bundled DSH Node 进程。

## 精确集合差

`scripts/verify-m0.ps1 -BaselineTools baseline-tools.json -CandidateTools candidate-tools.json` 退出码为 `0`。结果见 `tool-diff.json`：两个原始数量和去重数量均为 `0`，`added=[]`、`removed=[]`、`unchanged_count=0`。

这是 Desktop rc.1 运行态 `tools.schemas()` 的 target 证据；PowerShell 对快照的差集计算属于只读验证步骤，不以静态扫描替代运行态观察。
