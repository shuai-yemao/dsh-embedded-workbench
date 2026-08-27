import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

const cordisPath = "F:/DSH Desktop/resources/app/node_modules/@deepseek-ai/cordis/lib/index.js";
const { Context } = await import(pathToFileURL(cordisPath));
const host = await import("../src/index.js");

test("real Cordis Fiber owns the Host lifecycle disposer", async () => {
	const messages = [];
	const originalLog = console.log;
	console.log = (...args) => messages.push(args);
	try {
		const ctx = new Context();
		const fiber = ctx.plugin(host);
		await fiber;
		assert.equal(fiber.uid !== null, true);
		assert.ok(messages.some(([entry]) => entry === "[dsh-embedded-workbench] M0 loaded"));
		assert.ok(messages.some(([entry]) => typeof entry === "string" && entry.includes("LIFECYCLE" ) === false && entry.includes("lifecycle")));
		await fiber.dispose();
		assert.equal(fiber.uid, null);
	} finally {
		console.log = originalLog;
	}
});
