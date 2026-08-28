import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const packagePath = path.join(projectRoot, "package.json");
const patchPath = path.join(projectRoot, "cordis.patch.yml");
const providersPath = path.join(projectRoot, "src", "providers.js");
const clientEntryPath = path.join(projectRoot, "src", "client-entry.js");
const packageId = "@dsh-embedded/dsh-embedded-workbench";

test("package exposes one M2 Bundle with a generated Client artifact", async () => {
	const manifest = JSON.parse(await readFile(packagePath, "utf8"));

	assert.equal(manifest.name, packageId);
	assert.deepEqual(manifest.exports, {
		".": "./src/index.js",
		"./client": "./lib/client.js",
		"./cordis.patch.yml": "./cordis.patch.yml",
		"./package.json": "./package.json"
	});
	assert.deepEqual(manifest.files, ["src/index.js", "src/providers.js", "lib/client.js", "cordis.patch.yml"]);
	assert.deepEqual(manifest.dsh, {
		bundle: { patch: "./cordis.patch.yml" },
		client: {
			inject: [
				"@deepseek-ai/dsh-api-gateway",
				"@deepseek-ai/dsh-client-runtime",
				"@deepseek-ai/dsh-client-ui-settings"
			],
			platform: "web"
		}
	});
	assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
		"@dsh-embedded/workbench-contracts",
		"@dsh-embedded/workbench-core",
		"@dsh-embedded/workbench-ui"
	]);
	assert.deepEqual(manifest.optionalDependencies, { "@dsh-embedded/provider-reference": "0.0.0" });
	assert.deepEqual(manifest.peerDependencies, { "@deepseek-ai/cordis": "4.0.1" });
	assert.equal(manifest.dsh.client.inject.some(packageName => packageName.startsWith("@dsh-embedded/")), false);
	assert.equal(manifest.scripts.build, "tsc -b && node scripts/generate-typert.mjs && node scripts/build-client.mjs");
});

test("Bundle has one Loader row and keeps the Provider descriptor declarative", async () => {
	const [patch, providers, clientEntry] = await Promise.all([
		readFile(patchPath, "utf8"),
		readFile(providersPath, "utf8"),
		readFile(clientEntryPath, "utf8")
	]);

	assert.match(patch, /^- insert:/m);
	assert.match(patch, new RegExp(`^\\s+name: ['"]${packageId}['"]$`, "m"));
	assert.equal((patch.match(/^\s+- id:/gm) ?? []).length, 1);
	assert.match(providers, /capability_id:\s*"reference\.lifecycle"/);
	assert.match(providers, /package_name:\s*"@dsh-embedded\/provider-reference"/);
	assert.doesNotMatch(providers, /from\s+["'][^"']*provider-reference/);
	assert.match(clientEntry, /@dsh-embedded\/workbench-core\/remote/);
	assert.match(clientEntry, /remote\.\$mount\(/);
});
