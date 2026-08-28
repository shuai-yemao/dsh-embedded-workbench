import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const UI_PACKAGE_ID = "@dsh-embedded/workbench-ui";

test("generated UI Client registers one ModuleLoader package without browser-global side effects", async () => {
	const source = await readFile(new URL("../packages/workbench-ui/lib/client.js", import.meta.url), "utf8");
	const registrations = [];
	const window = { __ModuleLoader__: { load: registration => registrations.push(registration) } };
	vm.runInNewContext(source, { window }, { filename: "packages/workbench-ui/lib/client.js" });

	assert.equal(registrations.length, 1);
	assert.equal(registrations[0].id, UI_PACKAGE_ID);
	const client = registrations[0].factory(moduleId => {
		if (moduleId === "react") return { useSyncExternalStore: () => null };
		if (moduleId === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
		throw new Error(`unexpected external module: ${moduleId}`);
	});
	assert.deepEqual(Array.from(client.inject), ["slots", "settingsScope", "remote", "remote.workbenchCapabilities"]);
	assert.equal(typeof client.apply, "function");
	assert.equal("WebSocket" in window, false);
	assert.equal("addEventListener" in window, false);
});
