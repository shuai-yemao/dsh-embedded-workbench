# T-006 隔离运行态摘要

- Desktop bundled Node：`v24.9.0`；DSH：`0.1.1-rc.1`。
- 隔离 DSH_HOME：`D:\zhuomian\dsh-embedded-workbench\.mcu-workbench\runtime\20260826T163420+0800\dsh-home`。
- 隔离 profile manifest SHA-256：`310336A312495C5D269A5D01A06C50424683565B8B62EAA3ABCD160E13AD9790`。
- 隔离 lock SHA-256：`5A13C74F7F22B56DDF52A748D706C1812FCF36BFCEB14E99E62D9A51491ADBEE`。
- bundles：`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@dsh-embedded/dsh-embedded-workbench`；目标 bundle count=`1`，observer bundle count=`0`。
- observer 为 bundleless dependency：`@dsh-embedded/test-tool-snapshot`。
- `dump-config.txt`：exit=`0`、SHA-256=`0239C306F54B3D0438BB40D2DB0844E93A27E8020A3638D89EBEFF74228AE574`、目标 row/name 各 `1`、observer row=`0`、stderr bytes=`0`。
- 隔离 Web：PID=`85444`，Desktop Node，开始于 `2026-08-26T21:54:36+08:00`，监听 `127.0.0.1:6384`。
- Host marker：`[dsh-embedded-workbench] M0 loaded` count=`1`；stderr bytes=`0`。
- HTTP：`/` status=`200` 且含 `__DSH_BOOT__`；目标 client 路由 status=`200`，SHA-256=`23A90CD5CF46392256012386F918A71E20E879F6CE69DC97F02B2AD658F5B712`，含 ModuleLoader 与目标 package ID。
- 运行日志仍被 PID 85444 持有；其最终哈希留给 T-009 进程停止后记录。
