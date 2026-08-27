# T-006 执行记录

- allocation_id: `T-006-20260827T001`
- primary_agent: `verification-engineer`
- support_agents: `toolchain-engineer`
- primary_implementation_skill: `mcu-workbench:tools-quality`
- supporting_skills: `mcu-workbench:tools-verification`
- scope_boundary: 新增只读 M1 verifier，不修改外部 profile 或运行环境。

## 测试先行

- 当前行为：仓库不存在 `scripts/verify-m1.ps1` 与 `verify:m1` 脚本入口。
- 缺失证明：执行前 `Test-Path scripts/verify-m1.ps1` 返回 `False`（记录为 `missing-as-expected`）。

## 实现与验证

- 新增 `scripts/verify-m1.ps1`，检查私有 Lifecycle、package files/exports、禁止能力和 Host disposer/diagnostics。
- `package.json` 新增 `verify:m1` 入口。
- 首次运行发现 PowerShell 保留变量 `$Host` 冲突和自动变量 `$Matches` 序列化问题，已在本任务范围内修正。
- 命令：cwd=`D:\zhuomian\dsh-embedded-workbench`; `npm run verify:m1`。
- 实际结果：退出码 0，JSON `status=pass`，全部六项检查为 true，forbidden_matches 为空。

## 结果

- status: `pass`
- artifacts: `scripts/verify-m1.ps1`、verifier JSON。
- next_task: `T-007` / `T-008`（并行组 G-01）
