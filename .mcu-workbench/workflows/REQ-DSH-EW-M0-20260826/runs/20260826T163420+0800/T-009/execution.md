# T-009 执行记录

| 字段 | 内容 |
|---|---|
| allocation_id | `T-009-20260826T222243+0800` |
| primary_agent | `toolchain-engineer` |
| support_agents | `verification-engineer` |
| primary_implementation_skill | `mcu-workbench:tools-verification` |
| supporting_skills | `mcu-workbench:tools-quality`（advisory） |
| project_root/cwd | `D:\zhuomian\dsh-embedded-workbench` |
| status | `pass` |

## 精确边界与资源接管

- 仅操作已解析且位于项目内的 `D:\\zhuomian\\dsh-embedded-workbench\\.mcu-workbench\\runtime\\20260826T163420+0800\\dsh-home\\profiles\\web`。
- 先精确停止 T-008 留下的 PID `91636`；端口 `51229` 已释放。首次路径预检误用 PowerShell 只读变量 `$HOME`，但未执行 remove；随后以 `$dshHome` 重新解析 profile 后再继续。
- remove 前，目标 package 是唯一待移除 identity；其 dependency 与 bundle row 都存在，observer 是 bundleless test fixture dependency。

## 目标包回滚

- 使用 Desktop bundled Node `v24.9.0` 与 DSH `0.1.1-rc.1` 的官方命令精确执行 `plugin --profile web remove @dsh-embedded/dsh-embedded-workbench`，退出码为 0；输出见 `remove.stdout.log`，stderr 为 0。
- remove 后 manifest 仅保留 observer dependency，bundle 回到 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`；rollback dump 中 target row 与 observer row 均为 0。
- 回滚 Web 使用 PID `90156`、端口 `51229` 启动；目标 Host marker 为 0、stderr 为 0；目标 client URL 返回 HTTP 404；浏览器真实打开 Settings 后“嵌入式开发工作台”按钮数量为 0，console error 为 0。
- 随后停止 PID `90156` 并确认端口释放。

## Fixture 清理与最终状态

- 在目标回滚证据完成后，使用官方命令精确移除 `@dsh-embedded/test-tool-snapshot` observer fixture；退出码为 0，stderr 为 0。该清理不替代目标包回滚的“其他 bundle 保持”比较，且只针对测试 fixture identity。
- 最终隔离 manifest dependencies 为空，bundles 仍仅为 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`；final dump 中 target/observer row 均为 0，端口 `51229` 无监听。
- 当前用户 profile 哈希仍为 package `5436FE5B8945455383572314F146A11221DEFA8C6162D2D7D72ED8F7BBDE2958`、lock `BCFDB982F8DCE51D67B51D3E214ED0E08738D7385F18BA0F2FACB64C112BF639`，与 T-006 施工前后基线一致。

## 关键哈希

| 文件 | SHA-256 |
|---|---|
| `remove.stdout.log` | `429FD39F8BC4F44BF3CFCE7A595304FAF018C41FAAA8D25095E4C5D84A3B9586` |
| `rollback-dump-config.txt` | `CEE7CD4D8C757DDF74A0BCA9038CA817E2282F6C79F5C01D57BAA89F871D4316` |
| `rollback-web.stdout.log` | `D2CD381AED5833F198DD5BB307A474CD996F981C0A24D5EFD4DBF2714D8D5792` |
| `observer-remove.stdout.log` | `5BD70A04367AED9EB7F33104568C4DE55BB010C3A7345BC8C42BAA7F3617C9BC` |
| `final-dump-config.txt` | `CEE7CD4D8C757DDF74A0BCA9038CA817E2282F6C79F5C01D57BAA89F871D4316` |

## 证据等级

T-009 为 `target（Desktop rc.1 runtime/browser UI）`。它证明隔离 profile 的目标包回滚，不宣称当前用户 production profile、目标板硬件或发布流程已经验证。

## 复核与结论

- toolchain-engineer：PASS。确认两个记录 PID 均退出、official remove 顺序正确、base/web bundle 保持、protected profile 无 diff。
- system-architect：PASS。确认满足 V-M0-07，且 product rollback 与 observer fixture 后续清理严格区分；未把 T-009 误表述为工具集合复验。
- 结论：T-009 `pass`。
