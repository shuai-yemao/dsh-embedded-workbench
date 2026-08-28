import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();
for (const script of ["verify-m0.ps1", "verify-m1.ps1"]) {
	test(`${script} validates the M2-compatible regression boundary`, () => {
		const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "scripts", script), "-ProjectRoot", root], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.equal(JSON.parse(result.stdout).status, "pass");
	});
}
