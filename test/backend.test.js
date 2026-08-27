import assert from "node:assert/strict";
import test from "node:test";

const marker = "[dsh-embedded-workbench] M0 loaded";

test("host apply logs its marker without accessing context services", async () => {
	const messages = [];
	const originalLog = console.log;
	const rejectContextUse = (operation, property) => {
		throw new Error(
			`unexpected context ${operation}: ${String(property ?? "")}`
		);
	};
	const context = new Proxy(Object.create(null), {
		defineProperty: (_target, property) => rejectContextUse("define", property),
		deleteProperty: (_target, property) => rejectContextUse("delete", property),
		get: (_target, property) => rejectContextUse("get", property),
		getOwnPropertyDescriptor: (_target, property) =>
			rejectContextUse("describe", property),
		getPrototypeOf: () => rejectContextUse("getPrototypeOf"),
		has: (_target, property) => rejectContextUse("has", property),
		isExtensible: () => rejectContextUse("isExtensible"),
		ownKeys: () => rejectContextUse("ownKeys"),
		preventExtensions: () => rejectContextUse("preventExtensions"),
		set: (_target, property) => rejectContextUse("set", property),
		setPrototypeOf: () => rejectContextUse("setPrototypeOf")
	});

	console.log = (...args) => messages.push(args);
	try {
		const host = await import("../src/index.js");
		const result = host.apply(context);

		assert.deepEqual(Object.keys(host).sort(), ["apply", "name"]);
		assert.equal(host.name, "dsh-embedded-workbench");
		assert.equal(result, undefined);
	} finally {
		console.log = originalLog;
	}

	assert.deepEqual(messages, [[marker]]);
});
