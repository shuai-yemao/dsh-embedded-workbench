# T-007 执行记录

- allocation_id: `T-007-20260827T001`
- primary_agent: `verification-engineer`
- support_agents: `none`
- primary_implementation_skill: `mcu-workbench:tools-verification`
- supporting_skills: `mcu-workbench:workflow-final-review`
- scope_boundary: 只新增真实 Cordis Host fixture 测试，不修改产品源码或用户 profile。

## 测试先行

- 当前行为：M1 Adapter 已通过 Host 单元测试，但尚未证明真实 Cordis Fiber 会接管其返回 disposer。
- 缺失证明：新增 `test/cordis-host.test.js`，在真实 Desktop rc.1 Cordis 4.0.1 上执行 apply/unload。

## 验证

- 命令：cwd=`D:\zhuomian\dsh-embedded-workbench`; `node --test test/cordis-host.test.js`。
- 实际结果：退出码 0，1/1 pass；Fiber 激活成功，加载 marker 与结构化 lifecycle 日志出现，`fiber.dispose()` 后 uid 为 null。
- 证据等级：`host`，真实 Cordis 4.0.1；不等同 Desktop UI 验证。

## 结果

- status: `pass`
- artifacts: `test/cordis-host.test.js`、Cordis host log。
- next_task: `T-008`
