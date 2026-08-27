# T-008 执行记录

- allocation_id: `T-008-20260827T001`
- primary_agent: `verification-engineer`
- support_agents: `toolchain-engineer`
- primary_implementation_skill: `mcu-workbench:tools-verification`
- supporting_skills: `mcu-workbench:tools-quality`
- scope_boundary: 仅使用项目内隔离 `DSH_HOME` 验证 Desktop DSH rc.1；不写当前用户 profile。
- isolated_dsh_home: `D:\zhuomian\dsh-embedded-workbench\.mcu-workbench\runtime\20260827T000002+0800\dsh-home`

## 测试先行

- 当前行为：M1 Desktop runtime 生命周期证据尚不存在。
- 缺失证明：在隔离 profile 中执行真实 rc.1 Loader 激活、Web runtime、同进程 Ctrl-C unload 和第二次启动，建立旧新 instance 证据。

## 验证结果

- `plugin --profile web add file:D:/zhuomian/dsh-embedded-workbench`：exit 0。
- `--profile web --dump-config`：exit 0，目标 bundle row 出现一次。
- Web runtime 第一次：instance `workbench-mtba2s0k-0apytx`，启动日志为 CREATED→STARTING→RUNNING；同一进程 Ctrl-C 后 STOPPING→STOPPED，cleanup_complete=true。
- Web runtime 第二次：instance `workbench-mtba3i0z-d25pl4`，与第一次不同，证明新激活周期创建新对象。
- HTTP：第一次 runtime root `127.0.0.1:40256` 返回 200；client 路由返回 200，内容包含 Settings section 标识。
- `plugin --profile web remove @dsh-embedded/dsh-embedded-workbench`：exit 0；post-remove dump 中目标 row/package 匹配数为 0。
- 证据等级：`target`（Desktop rc.1 runtime；不是 MCU target）。

## 结果

- status: `pass`
- artifacts: isolated profile、dump-config、Web runtime 输出、remove 输出、instance trace。
- next_task: `T-009`

## B-04 补充复核（2026-08-27）

- Settings UI 人工复核：`http://127.0.0.1:8312` 页面真实加载；设置导航显示“嵌入式开发工作台”，进入后显示“M0 插件已加载。更多嵌入式能力将在后续里程碑提供。”。
- 插件管理页确认 `embedded-workbench` 为“已挂载、已启用”，无独立禁用/重新启用控件。
- live reload 入口复核：Desktop rc.1 Web patch 将 Host HMR 行明确配置为 `disabled: true`（`@deepseek-ai/dsh-web-app/cordis.patch.yml` 的 TODO 说明为待完成 reload 生命周期测试后再启用）；当前 Web UI 与 CLI 未提供针对静态 bundle 插件的同一 Loader disable/re-enable 操作入口。
- 结论：`V-M1-13` Settings UI 已补证；`V-M1-12` 仍 `blocked/unverified`，不能用进程重启或普通页面刷新替代同一 Loader live reload 证据。
