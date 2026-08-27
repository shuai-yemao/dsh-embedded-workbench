import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projectRoot = process.cwd();
const scriptPath = path.join(projectRoot, "scripts", "verify-m0.ps1");
const packagePath = path.join(projectRoot, "package.json");
const snapshotFixtureRoot = path.join(projectRoot, "test", "runtime", "tool-snapshot", "fixtures");

function runVerify(...argumentsList) {
	return spawnSync("powershell", [
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-File",
		scriptPath,
		"-ProjectRoot",
		projectRoot,
		...argumentsList
	], {
		cwd: projectRoot,
		encoding: "utf8"
	});
}

test("read-only M0 verifier reports the complete package contract", () => {
	assert.equal(existsSync(scriptPath), true, "verify-m0.ps1 must exist");

	const result = runVerify();
	assert.equal(result.status, 0, result.stderr || result.stdout);
	const report = JSON.parse(result.stdout);

	assert.equal(report.status, "pass");
	assert.equal(report.evidence_level, "static");
	assert.equal(report.project_root, projectRoot);
	assert.deepEqual(report.forbidden_matches, []);
	assert.deepEqual(report.checks, {
		manifest: true,
		exports: true,
		patch: true,
		files: true,
		forbidden: true,
		profile: "not_requested",
		base_url: "not_requested",
		tool_snapshot: "not_requested"
	});
});

test("read-only M0 verifier rejects a missing project root", () => {
	const missingRoot = path.join(projectRoot, "does-not-exist");
	const result = spawnSync("powershell", [
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-File",
		scriptPath,
		"-ProjectRoot",
		missingRoot
	], {
		cwd: projectRoot,
		encoding: "utf8"
	});

	assert.notEqual(result.status, 0);
	assert.match(`${result.stdout}\n${result.stderr}`, /ProjectRoot does not exist/);
});

test("read-only M0 verifier only reads optional profile and snapshot inputs", () => {
	const result = runVerify(
		"-ProfileDir",
		projectRoot,
		"-ToolSnapshotPath",
		packagePath
	);

	assert.equal(result.status, 0, result.stderr || result.stdout);
	const report = JSON.parse(result.stdout);
	assert.equal(report.checks.profile, "readable");
	assert.equal(report.checks.tool_snapshot, "readable");
});

test("verification script and package tarball stay inside the read-only M0 boundary", () => {
	const source = readFileSync(scriptPath, "utf8");
	assert.match(source, /Invoke-WebRequest -Uri \$uri -Method Get -TimeoutSec 5/);
	for (const forbiddenOperation of [
		"Remove-Item",
		"Set-Content",
		"Add-Content",
		"Out-File",
		"Copy-Item",
		"Move-Item",
		"New-Item",
		"Start-Process",
		"plugin add",
		"plugin remove",
		"pnpm install"
	]) {
		assert.doesNotMatch(source, new RegExp(forbiddenOperation, "i"));
	}

	const packCommand = process.platform === "win32" ? "npm.cmd" : "npm";
	const pack = spawnSync(packCommand, ["pack", "--dry-run", "--json"], {
		cwd: projectRoot,
		encoding: "utf8",
		shell: process.platform === "win32"
	});
	assert.equal(pack.status, 0, pack.stderr || pack.stdout);
	const packedFiles = JSON.parse(pack.stdout)[0].files.map((entry) => entry.path).sort();
	assert.deepEqual(packedFiles, [
		"cordis.patch.yml",
		"package.json",
		"src/client.js",
		"src/index.js"
	]);
});

test("read-only M0 verifier computes an exact tool-name set diff", () => {
	const result = runVerify(
		"-BaselineTools",
		path.join(snapshotFixtureRoot, "baseline.json"),
		"-CandidateTools",
		path.join(snapshotFixtureRoot, "candidate-same.json")
	);

	assert.equal(result.status, 0, result.stderr || result.stdout);
	const report = JSON.parse(result.stdout);
	assert.deepEqual(report.tool_diff, {
		baseline_raw_count: 3,
		candidate_raw_count: 3,
		baseline_unique_count: 3,
		candidate_unique_count: 3,
		added: [],
		removed: [],
		unchanged_count: 3
	});
});

test("read-only M0 verifier rejects a changed tool-name set", () => {
	const result = runVerify(
		"-BaselineTools",
		path.join(snapshotFixtureRoot, "baseline.json"),
		"-CandidateTools",
		path.join(snapshotFixtureRoot, "candidate-extra.json")
	);

	assert.notEqual(result.status, 0);
	assert.match(`${result.stdout}\n${result.stderr}`, /Tool set changed/);
});
