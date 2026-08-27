import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const projectRoot = process.cwd();
const fixtureRoot = path.join(projectRoot, "test", "runtime", "tool-snapshot");
const observerPath = path.join(fixtureRoot, "index.js");
const observerPackagePath = path.join(fixtureRoot, "package.json");
const observerPatchPath = path.join(fixtureRoot, "cordis.patch.yml");
const baselinePatchPath = path.join(fixtureRoot, "baseline.disable-target.patch.yml");

function guardedInterface(target, allowedProperties, name) {
	const reject = (operation, property = "") => {
		throw new Error(`${name} ${operation} is forbidden${property === "" ? "" : `: ${String(property)}`}`);
	};

	return new Proxy(target, {
		get(current, property, receiver) {
			assert.ok(allowedProperties.includes(property), `unexpected ${name} access: ${String(property)}`);
			return Reflect.get(current, property, receiver);
		},
		set(_current, property) {
			return reject("set", property);
		},
		defineProperty(_current, property) {
			return reject("defineProperty", property);
		},
		deleteProperty(_current, property) {
			return reject("deleteProperty", property);
		},
		has(_current, property) {
			return reject("has", property);
		},
		ownKeys() {
			return reject("ownKeys");
		},
		getOwnPropertyDescriptor(_current, property) {
			return reject("getOwnPropertyDescriptor", property);
		},
		getPrototypeOf() {
			return reject("getPrototypeOf");
		},
		setPrototypeOf() {
			return reject("setPrototypeOf");
		},
		isExtensible() {
			return reject("isExtensible");
		},
		preventExtensions() {
			return reject("preventExtensions");
		}
	});
}

test("test-only tool snapshot fixture stays outside the product package", () => {
	for (const pathToCheck of [observerPath, observerPackagePath, observerPatchPath, baselinePatchPath]) {
		assert.equal(existsSync(pathToCheck), true, `missing fixture: ${pathToCheck}`);
	}

	const rootManifest = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
	assert.doesNotMatch(JSON.stringify(rootManifest), /tool-snapshot|dsh-tools/);
	assert.deepEqual(rootManifest.files, [
		"src/index.js",
		"src/client.js",
		"src/workbench-lifecycle.js",
		"cordis.patch.yml"
	]);

	const fixtureManifest = JSON.parse(readFileSync(observerPackagePath, "utf8"));
	assert.equal(fixtureManifest.name, "@dsh-embedded/test-tool-snapshot");
	assert.equal(fixtureManifest.private, true);
	assert.deepEqual(fixtureManifest.exports, {
		".": "./index.js",
		"./cordis.patch.yml": "./cordis.patch.yml",
		"./baseline.disable-target.patch.yml": "./baseline.disable-target.patch.yml",
		"./package.json": "./package.json"
	});
	assert.equal(fixtureManifest.dsh, undefined);
	assert.deepEqual(fixtureManifest.files, [
		"index.js",
		"cordis.patch.yml",
		"baseline.disable-target.patch.yml"
	]);
	assert.equal(fixtureManifest.dependencies, undefined);
	assert.equal(fixtureManifest.optionalDependencies, undefined);

	const observerComposition = readFileSync(observerPatchPath, "utf8")
		.split(/\r?\n/)
		.filter((line) => line.trim() && !line.trimStart().startsWith("#"))
		.join("\n");
	assert.equal(observerComposition, [
		"- insert:",
		"    - id: dsh-embedded-test-tool-snapshot",
		"      name: '@dsh-embedded/test-tool-snapshot'"
	].join("\n"));
	assert.equal(readFileSync(baselinePatchPath, "utf8").trim(), [
		"- id: dsh-embedded-workbench",
		"  disabled: true"
	].join("\n"));
});

test("test-only observer emits one sorted read-only tool snapshot", async () => {
	assert.doesNotMatch(readFileSync(observerPath, "utf8"), /(?:tools\.register|defineTool)/);
	const previousRun = process.env.DSH_M0_RUN_ID;
	const previousPhase = process.env.DSH_M0_TOOL_SNAPSHOT_PHASE;
	process.env.DSH_M0_RUN_ID = "run-123";
	process.env.DSH_M0_TOOL_SNAPSHOT_PHASE = "baseline";

	const messages = [];
	const originalLog = console.log;
	const tools = guardedInterface({
		schemas() {
			assert.equal(arguments.length, 0);
			return [{ name: "zeta" }, { name: "alpha" }, { name: "middle" }];
		}
	}, ["schemas"], "tools");
	const ctx = guardedInterface({ tools }, ["tools"], "ctx");

	console.log = (...args) => messages.push(args);
	try {
		const observer = await import(`${pathToFileURL(observerPath).href}?test=${Date.now()}`);
		assert.deepEqual(Object.keys(observer).sort(), ["apply", "inject", "name"]);
		assert.equal(observer.name, "dsh-embedded-test-tool-snapshot");
		assert.deepEqual(observer.inject, ["tools"]);
		assert.equal(observer.apply(ctx), undefined);
	} finally {
		console.log = originalLog;
		if (previousRun === undefined) delete process.env.DSH_M0_RUN_ID;
		else process.env.DSH_M0_RUN_ID = previousRun;
		if (previousPhase === undefined) delete process.env.DSH_M0_TOOL_SNAPSHOT_PHASE;
		else process.env.DSH_M0_TOOL_SNAPSHOT_PHASE = previousPhase;
	}

	assert.equal(messages.length, 1);
	assert.deepEqual(JSON.parse(messages[0][0]), {
		marker: "dsh-embedded-tool-snapshot",
		run: "run-123",
		phase: "baseline",
		tools: ["alpha", "middle", "zeta"]
	});
});
