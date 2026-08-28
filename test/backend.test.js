import assert from "node:assert/strict";
import test from "node:test";

import * as host from "../src/index.js";

test("Host registers the generated Typert contribution before one Core Fiber and unwinds in reverse", async () => {
	const operations = [];
	const registrations = [];
	const coreFiber = {
		async await() { operations.push("core.await"); },
		async dispose() { operations.push("core.dispose"); }
	};
	const context = {
		typert: {
			register(contribution) {
				operations.push("typert.register");
				registrations.push(contribution);
				return async () => operations.push("typert.dispose");
			}
		},
		plugin(plugin, config) {
			operations.push("core.plugin");
			assert.equal(typeof plugin.apply, "function");
			assert.equal(plugin.inject.includes("settings"), true);
			assert.equal(config.providers.length, 1);
			assert.equal(config.providers[0].capability_id, "reference.lifecycle");
			assert.equal(config.packageBaseUrl, new URL("../src/index.js", import.meta.url).href);
			return coreFiber;
		}
	};

	assert.deepEqual(Object.keys(host).sort(), ["apply", "inject", "name"]);
	assert.equal(host.name, "dsh-embedded-workbench");
	assert.deepEqual(host.inject, ["typert"]);

	const dispose = await host.apply(context);
	assert.equal(registrations.length, 1);
	assert.equal(registrations[0].face, "host");
	assert.deepEqual(operations, ["typert.register", "core.plugin", "core.await"]);

	await dispose();
	assert.deepEqual(operations, ["typert.register", "core.plugin", "core.await", "core.dispose", "typert.dispose"]);
});

test("Host rolls back the Core Fiber and Typert registration if Core startup rejects", async () => {
	const operations = [];
	const context = {
		typert: {
			register() {
				operations.push("typert.register");
				return async () => operations.push("typert.dispose");
			}
		},
		plugin() {
			operations.push("core.plugin");
			return {
				async await() {
					operations.push("core.await");
					throw new Error("fixture Core startup failure");
				},
				async dispose() { operations.push("core.dispose"); }
			};
		}
	};

	await assert.rejects(() => host.apply(context), /fixture Core startup failure/);
	assert.deepEqual(operations, ["typert.register", "core.plugin", "core.await", "core.dispose", "typert.dispose"]);
});
