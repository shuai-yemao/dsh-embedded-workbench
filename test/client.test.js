import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const BUNDLE_PACKAGE_ID = "@dsh-embedded/dsh-embedded-workbench";

test("generated root Client composes the Remote mount and embedded Settings section", async () => {
	const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
	const registrations = [];
	const window = { __ModuleLoader__: { load: registration => registrations.push(registration) } };
	vm.runInNewContext(source, { window }, { filename: "lib/client.js" });

	assert.equal(registrations.length, 1);
	assert.equal(registrations[0].id, BUNDLE_PACKAGE_ID);
	const client = registrations[0].factory(moduleId => {
		if (moduleId === "react") return { useSyncExternalStore: () => null };
		if (moduleId === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
		throw new Error(`unexpected external module: ${moduleId}`);
	});
	assert.deepEqual(Array.from(client.inject), ["remote"]);
	assert.equal(typeof client.apply, "function");
	const operations = [];
	let dynamicDependencies;
	const context = {
		remote: {
			$mount: async () => { operations.push("remote.mount"); },
			workbenchCapabilities: {
				list: async () => ({ ok: true, value: { health: "READY", capabilities: [] } }),
				retry: async () => ({ ok: true, value: undefined }),
				reconcile: async () => ({ ok: true, value: undefined }),
			},
		},
		settingsScope: {
			bind: () => ({
				getSnapshot: () => ({ value: { capabilities: {} }, writable: true }),
				subscribe: () => () => {},
				set: async () => {},
				unset: async () => {},
			}),
		},
		on: () => () => {},
		inject: (deps, callback) => {
			dynamicDependencies = Array.from(deps);
			operations.push("context.inject");
			return callback(context);
		},
		effect: async callback => { operations.push("effect"); await callback(); },
		slots: {
			inject: (_name, callback) => { operations.push("slots.inject"); return callback(); },
			register: (_options, component) => { operations.push("slots.register"); return component; },
		},
	};
	await client.apply(context);
	assert.deepEqual(dynamicDependencies, ["slots", "settingsScope", "remote", "remote.workbenchCapabilities"]);
	assert.deepEqual(operations, ["remote.mount", "context.inject", "effect", "slots.inject", "slots.register"]);
	assert.equal("WebSocket" in window, false);
	assert.equal("addEventListener" in window, false);
});
