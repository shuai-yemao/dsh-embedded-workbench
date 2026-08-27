# T-008 执行记录

| 字段 | 内容 |
|---|---|
| allocation_id | `T-008-20260826T221410+0800` |
| primary_agent | `verification-engineer` |
| support_agents | `system-architect` |
| primary_implementation_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:frontend-excellence`, `browser:control-in-app-browser` |
| project_root/cwd | `D:\zhuomian\dsh-embedded-workbench` |
| status | `pass` |

## 施工前边界

- 仅使用项目内隔离 `DSH_HOME` 和 Desktop bundled rc.1；不写当前用户 profile 或官方运行时。
- HTTP client route 只能作为启动前提，不能代替 Settings 实际渲染、点击、刷新、重启和控制台检查。
- 运行进程会记录 PID/端口并在 T-009 前保持或按需要有界停止；不影响无关 Desktop 实例。

## 启动与 UI 验收

- 首次后台启动因 `Start-Process` 将含空格的 DSH 脚本路径拆分为 `F:\\DSH` 而失败；无监听、无 profile 写入。该失败保留在 `ui.stderr.log`，未作为 UI 证据。
- 修正为完整引用的脚本参数后，隔离 rc.1 Web 以 PID `82608` 监听 `127.0.0.1:51229`；Host marker 一次、stderr 为 0。
- 浏览器实际打开该隔离 URL，完成只读/本地引导后进入 Settings：左侧精确显示并可点击“嵌入式开发工作台”；页面显示 H2 同名标题和正文“`M0 插件已加载。更多嵌入式能力将在后续里程碑提供。`”。浏览器内可视画面已人工核对；截图不作为本目录的可下载附件。
- 刷新后，首次引导再次出现；选择“稍后配置”后重新进入 Settings，名称、内容均仍存在，浏览器 console error 为 0。
- 关闭已记录 PID `82608` 后确认端口释放；在同一隔离 `DSH_HOME` 以 PID `91636` 重启同一端口，Host marker 一次、stderr 为 0。重启后再次进入 Settings，名称、内容仍存在，console error 为 0。

## 运行态边界

- 当前 PID `91636` 和端口 `51229` 为 T-009 精确 remove 前的受管资源；不把它作为其他 Desktop 实例处理。
- UI 验收为 `target（browser UI on Desktop rc.1 runtime）`；不包含模型配置、当前用户 profile、硬件、发布或任何 M1+ 功能。

## 复核与结论

- system-architect：PASS。确认 V-M0-04 的真实 Settings label、点击、刷新、重启和 console error=0 均有记录；首次引导与参数转义失败均未混入通过样本。
- 结论：T-008 `pass`。T-009 接管 PID `91636`/端口 `51229`，只按记录 PID 停止并执行官方精确 remove。
