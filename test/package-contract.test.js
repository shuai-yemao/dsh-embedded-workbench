import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const packagePath = path.join(projectRoot, "package.json");
const patchPath = path.join(projectRoot, "cordis.patch.yml");
const packageId = "@dsh-embedded/dsh-embedded-workbench";

test("package exposes one M0 host/client bundle contract", async () => {
	const manifest = JSON.parse(await readFile(packagePath, "utf8"));

	assert.equal(manifest.name, packageId);
	assert.equal(manifest.private, true);
	assert.equal(manifest.type, "module");
	assert.deepEqual(manifest.exports, {
		".": "./src/index.js",
		"./client": "./src/client.js",
		"./cordis.patch.yml": "./cordis.patch.yml",
		"./package.json": "./package.json"
	});
	assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
	assert.equal(manifest.dsh.client.platform, "web");
	assert.deepEqual(manifest.dsh.client.inject, [
		"@deepseek-ai/dsh-client-runtime",
		"@deepseek-ai/dsh-client-ui-settings"
	]);
	assert.deepEqual(Object.keys(manifest.peerDependencies).sort(), [
		"@deepseek-ai/cordis",
		"@deepseek-ai/dsh-client-runtime",
		"@deepseek-ai/dsh-client-ui-settings"
	]);
	assert.equal(manifest.peerDependencies["@deepseek-ai/cordis"], "^4.0.1");
	assert.equal(
		manifest.peerDependencies["@deepseek-ai/dsh-client-runtime"],
		"0.1.1-rc.1"
	);
	assert.equal(
		manifest.peerDependencies["@deepseek-ai/dsh-client-ui-settings"],
		"0.1.1-rc.1"
	);
	assert.deepEqual(manifest.files, [
		"src/index.js",
		"src/client.js",
		"cordis.patch.yml"
	]);
	assert.deepEqual(Object.keys(manifest.dsh).sort(), ["bundle", "client"]);
	assert.deepEqual(Object.keys(manifest.dsh.bundle), ["patch"]);
	assert.deepEqual(
		Object.keys(manifest.dsh.client).sort(),
		["inject", "platform"]
	);
	assert.equal(manifest.dependencies, undefined);
	assert.equal(manifest.optionalDependencies, undefined);
	assert.equal(manifest.devDependencies, undefined);
	assert.equal(manifest.peerDependenciesMeta, undefined);
	assert.equal(manifest.scripts.test, "node --test test/*.test.js");
	assert.equal(
		manifest.scripts["verify:m0"],
		"powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-m0.ps1"
	);
	assert.equal(manifest.scripts["pack:dry-run"], "npm pack --dry-run --json");
});

test("bundle patch inserts only the workbench row", async () => {
	const patch = await readFile(patchPath, "utf8");

	assert.match(patch, /^- insert:/m);
	assert.match(patch, /^\s+- id: dsh-embedded-workbench$/m);
	assert.match(patch, new RegExp(`^\\s+name: ['"]${packageId}['"]$`, "m"));
	assert.equal((patch.match(/^\s+- id:/gm) ?? []).length, 1);
	assert.doesNotMatch(patch, /^- (?:update|remove):/m);
	const composition = patch
		.split(/\r?\n/)
		.filter((line) => line.trim() && !line.trimStart().startsWith("#"))
		.join("\n");
	assert.equal(composition, [
		"- insert:",
		"    - id: dsh-embedded-workbench",
		`      name: '${packageId}'`
	].join("\n"));
});
