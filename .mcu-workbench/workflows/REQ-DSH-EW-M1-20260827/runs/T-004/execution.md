# T-004 执行记录

- allocation_id: `T-004-20260827T001`
- primary_agent: `firmware-engineer`
- support_agents: `system-architect`
- primary_implementation_skill: `mcu-workbench:workflow-ai-collab`
- supporting_skills: `mcu-workbench:codebase-design`
- scope_boundary: 修改 `src/index.js` 与 Host 测试；不修改 Client、patch、manifest 或外部 profile。

## 测试先行

- 当前行为：M0 `apply()` 为同步无状态函数并返回 `undefined`。
- 缺失证明：更新后的 `test/backend.test.js` 要求异步 Promise 和单一 disposer；实现前退出码 1，实际值为 `undefined`。
- 证据等级：`host`。

## 实现与验证

- `src/index.js` 现在创建本次 apply 专属 Lifecycle，await `start()`，返回 `() => lifecycle.dispose()`。
- 保留 M0 加载标记；Host 测试确认不访问 context、返回 disposer 且可完成清理。
- 命令：cwd=`D:\zhuomian\dsh-embedded-workbench`; `node --test test/backend.test.js test/lifecycle.test.js`。
- 实际结果：退出码 0，9/9 pass。

## 结果

- status: `pass`
- artifacts: `src/index.js`、`test/backend.test.js`、Host/lifecycle test log。
- next_task: `T-005`
