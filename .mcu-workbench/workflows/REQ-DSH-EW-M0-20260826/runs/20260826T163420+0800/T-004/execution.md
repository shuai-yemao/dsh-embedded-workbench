# T-004 执行记录

| 字段 | 内容 |
|---|---|
| allocation_id | `T-004-20260826T172118+0800` |
| primary_agent | `verification-engineer` |
| support_agents | `toolchain-engineer` |
| primary_implementation_skill | `mcu-workbench:tdd` |
| supporting_skills | `mcu-workbench:tools-verification, mcu-workbench:tools-quality` |
| project_root/cwd | `D:\zhuomian\dsh-embedded-workbench` |
| spec_version | `v0.1` |
| status | `pass` |

## 施工前边界

- 验证脚本只读取项目文件和显式传入的可选观察面，不安装、不删除、不修改 profile。
- 失败必须返回非零退出码，且指出 manifest、patch、identity、禁用依赖/token 或 pack 边界中的具体原因。
- static/host/build 证据分开记录，不外推为 Loader、UI、目标板或实物证据。

## 测试先行记录

- 命令：`cwd=D:\zhuomian\dsh-embedded-workbench; node --test test/verify-m0.test.js`。
- 预期失败：`scripts/verify-m0.ps1` 尚不存在。
- 实际：exit 1，0/2，失败于 `verify-m0.ps1 must exist`。
- 证据等级：`host`。

## 实现与验证

- 新增：`scripts/verify-m0.ps1`、`test/verify-m0.test.js`；补强：`package.json`、`test/package-contract.test.js`。
- verifier tests：exit 0，4/4。
- `npm test`：exit 0，8/8。
- `npm run verify:m0`：exit 0，JSON 为 `status=pass`、`evidence_level=static`、`forbidden_matches=[]`。
- `npm run pack:dry-run`：exit 0，包内仅 `cordis.patch.yml`、`package.json`、`src/client.js`、`src/index.js`。
- PowerShell syntax parse：exit 0。
- 行尾空白：无命中。

## SHA-256

- `package.json`：`565B9ADBE0CDC3BC5160EE76C20E8C695B9EAAC1E183A9895A0840FAF74B8BDA`
- `scripts/verify-m0.ps1`：`1021B2607E600742B9E914FB975BECCD5D90C51C25BB46E747B1E629194A6D64`
- `test/verify-m0.test.js`：`D20D0A6081DFE28796288BDE10179EB726F6E275F38D1A57048D0E910132B096`
- `test/package-contract.test.js`：`FFD2F33F33F89EC14D008EDF40B88FAB42D9FAC46380A888773EB40BCF5F0341`

## 审查与 SOLID

- system-architect：通过，无未关闭修订项。
- toolchain-engineer：通过，确认 Windows PowerShell 5.1 兼容、失败码和无写入边界。
- solid_status：`pass`；Verification 与产品入口、发布 files 完全隔离。
- 未验证：正向 BaseUrl GET、真实 Loader、UI、工具集合差和硬件均未由 T-004 覆盖。
