import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { startLocalRegistry } from "./local-registry.mjs";

const execFileAsync = promisify(execFile);
const root = new URL("../..", import.meta.url).pathname.slice(1);
const bundledNode = process.env.DSH_M2_NODE;
const dshBin = process.env.DSH_M2_BIN;

async function pack(directory, output) {
	const { stdout } = await execFileAsync("npm.cmd", ["pack", "--json", "--ignore-scripts", "--pack-destination", output], {
		cwd: directory,
		shell: process.platform === "win32",
	});
	const [result] = JSON.parse(stdout);
	return { tarballPath: join(output, result.filename), tarballName: result.filename };
}

async function records(output, includeReference) {
	const paths = [".", "packages/workbench-contracts", "packages/workbench-core", "packages/workbench-ui", ...(includeReference ? ["packages/provider-reference"] : [])];
	return Promise.all(paths.map(async relative => {
		const directory = join(root, relative);
		const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
		return { ...await pack(directory, output), name: manifest.name, version: manifest.version, dependencies: manifest.dependencies, optionalDependencies: manifest.optionalDependencies };
	}));
}

async function addWithRegistry(registryUrl, home, profile) {
	await writeFile(join(home, ".npmrc"), `@dsh-embedded:registry=${registryUrl}\nregistry=https://registry.npmjs.org/\n`, "utf8");
	const environment = { ...process.env, DSH_HOME: home, NPM_CONFIG_USERCONFIG: join(home, ".npmrc") };
	return execFileAsync(bundledNode, [dshBin, "plugin", "--profile", profile, "add", "@dsh-embedded/dsh-embedded-workbench@0.0.0", "--ignore-scripts"], { env: environment });
}

async function removeBundle(home, profile) {
	const environment = { ...process.env, DSH_HOME: home, NPM_CONFIG_USERCONFIG: join(home, ".npmrc") };
	return execFileAsync(bundledNode, [dshBin, "plugin", "--profile", profile, "remove", "@dsh-embedded/dsh-embedded-workbench"], { env: environment });
}

test("one CLI add installs the Bundle and tolerates a missing Optional Provider", { timeout: 120000 }, async () => {
	assert.ok(bundledNode, "DSH_M2_NODE is required");
	assert.ok(dshBin, "DSH_M2_BIN is required");
	const artifactDir = await mkdtemp(join(tmpdir(), "dsh-ew-m2-pack-"));
	const home = await mkdtemp(join(tmpdir(), "dsh-ew-m2-home-"));
	try {
		const fullRegistry = await startLocalRegistry(await records(artifactDir, true));
		try {
			await addWithRegistry(fullRegistry.url, home, "m2-full");
			const { stat } = await import("node:fs/promises");
			assert.equal(await stat(join(home, "profiles", "m2-full", "node_modules", "@dsh-embedded", "provider-reference")).then(() => true, () => false), true);
			const settingsPath = join(home, "settings.yaml");
			const settings = 'dsh-embedded-workbench:\n  capabilities:\n    reference.lifecycle:\n      enabled: false\n';
			await writeFile(settingsPath, settings, "utf8");
			await removeBundle(home, "m2-full");
			assert.equal(await stat(join(home, "profiles", "m2-full", "node_modules", "@dsh-embedded", "dsh-embedded-workbench")).then(() => true, () => false), false);
			assert.equal(await readFile(settingsPath, "utf8"), settings);
			await addWithRegistry(fullRegistry.url, home, "m2-full");
			assert.equal(await readFile(settingsPath, "utf8"), settings);
		} finally {
			await fullRegistry.close();
		}

		const missingRegistry = await startLocalRegistry(await records(artifactDir, false));
		try {
			await addWithRegistry(missingRegistry.url, home, "m2-missing");
			const { stat } = await import("node:fs/promises");
			assert.equal(await stat(join(home, "profiles", "m2-missing", "node_modules", "@dsh-embedded", "dsh-embedded-workbench")).then(() => true, () => false), true);
			assert.equal(await stat(join(home, "profiles", "m2-missing", "node_modules", "@dsh-embedded", "provider-reference")).then(() => true, () => false), false);
		} finally {
			await missingRegistry.close();
		}
	} finally {
		await rm(artifactDir, { recursive: true, force: true });
		await rm(home, { recursive: true, force: true });
	}
});
