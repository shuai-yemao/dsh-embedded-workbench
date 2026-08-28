# M2 运行态补充证据（2026-08-28）

## E-M2-RT-01：缺失 Optional Provider 的真实 rc.2 Host/UI 投影

- 证据等级：`runtime + UI`
- 工具仓库：`D:\zhuomian\dsh-embedded-workbench`
- DSH 版本：`@deepseek-ai/dsh 0.1.1-rc.2`
- Cordis 版本：`@deepseek-ai/cordis 4.0.1`
- 启动命令：

  ```powershell
  $env:DSH_HOME='C:\Users\zhang\AppData\Local\Temp\dsh-m2-missing-evidence-20260828'
  & 'F:\DSH Desktop\resources\app\node_modules\node\bin\node.exe' `
    'F:\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js' `
    --profile web --no-open --host 127.0.0.1 --port 0
  ```

- 隔离方式：临时 `DSH_HOME` 映射现有 Web profile；临时隐藏 `@dsh-embedded/provider-reference`，验证结束后恢复。
- Host 输出：`dsh web: http://127.0.0.1:1374`。
- Settings 页面选择“嵌入式开发工作台”后，真实页面显示：
  - 能力 ID：`reference.lifecycle`
  - 可用性：`MISSING`
  - 运行阶段：`STOPPED`
  - 应用方式：`LIVE`
  - 工作台状态：`能力不可用`
  - 错误码：`CAPABILITY_MISSING`
  - 阶段：`discover`
  - 错误信息：`未安装 Optional Provider：@dsh-embedded/provider-reference`
  - 页面仍提供“重试”和“恢复默认设置”，且启用开关保持可见。
- Playwright headed 快照：[m2-missing-provider.yml](../../../output/playwright/m2-missing-provider.yml)。
- 可视化截图：[m2-missing-provider.png](../../../output/playwright/m2-missing-provider.png)。

结论：`V-M2-06`、`V-M2-13`、`V-M2-16` 的缺失 Provider 运行态投影与 UI 降级证据已补齐；未将 HTTP 200 或静态安装结果作为替代证据。

## E-M2-RT-02：真实 Cordis Fiber 隔离

- 证据等级：`host`
- 测试：`packages/workbench-core/test/controller.test.ts` 中“provider A failure does not stop provider B”。
- 测试使用真实 `Context`、`Fiber` 和 `ctx.plugin()`，依赖树固定为 `@deepseek-ai/cordis@4.0.1`。
- 结果：失败 Provider 进入 `FAILED`；兄弟 Provider 进入 `RUNNING`；dispose 只清理健康 Provider 的资源。
- 回归命令：`npm test`，退出码 `0`，全部 workspace 测试通过。

结论：`B-M2-03` 的真实 Cordis Host 证据已补齐；测试中的 Provider resolver 仍是受控 fixture，不宣称真实硬件 Provider 验证。

## E-M2-RT-03：自动门回归

- `npm test`：通过。
- `npm run build`：通过。
- `npm run verify:m2`：通过。
- `npm run verify:m2:runtime`：通过，包含真实 bundled DSH CLI 的一次安装、Optional 缺失容错、精确 remove 和 Settings 保留。
- `npm ls @deepseek-ai/cordis --depth=0`：`4.0.1`。

## 清理记录

- 临时 Provider 隐藏项已恢复为 `D:\zhuomian\dsh-embedded-workbench-m2\node_modules\@dsh-embedded\provider-reference`。
- 正式 profile 未被修改；验证使用独立临时 `DSH_HOME`。
