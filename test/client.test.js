import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const PACKAGE_ID = "@dsh-embedded/dsh-embedded-workbench";
const SECTION_LABEL = "嵌入式开发工作台";

function jsx(type, props = {}) {
	return { type, props };
}

function guardedInterface(target, allowedProperties, interfaceName) {
	const reject = (operation, property = "") => {
		throw new Error(`${interfaceName} ${operation} is forbidden${property === "" ? "" : `: ${String(property)}`}`);
	};

	return new Proxy(target, {
		get(current, property, receiver) {
			assert.ok(allowedProperties.includes(property), `unexpected ${interfaceName} access: ${String(property)}`);
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

test("client registers one accessible Settings section and cleans it up", async () => {
	const source = await readFile(new URL("../src/client.js", import.meta.url), "utf8");
	const loadCalls = [];
	const forbiddenGlobal = Object.freeze(() => {
		throw new Error("client must not create global listeners, async work, workers, or connections");
	});
	const moduleLoaderTarget = {
		load: Object.freeze(function load(definition) {
			loadCalls.push(definition);
		})
	};
	const moduleLoader = guardedInterface(moduleLoaderTarget, ["load"], "moduleLoader");
	const windowTarget = {
		__ModuleLoader__: moduleLoader,
		addEventListener: forbiddenGlobal,
		removeEventListener: forbiddenGlobal,
		setInterval: forbiddenGlobal,
		clearInterval: forbiddenGlobal,
		setTimeout: forbiddenGlobal,
		clearTimeout: forbiddenGlobal,
		queueMicrotask: forbiddenGlobal,
		requestAnimationFrame: forbiddenGlobal,
		cancelAnimationFrame: forbiddenGlobal,
		requestIdleCallback: forbiddenGlobal,
		cancelIdleCallback: forbiddenGlobal,
		Worker: forbiddenGlobal,
		WebSocket: forbiddenGlobal,
		EventSource: forbiddenGlobal,
		BroadcastChannel: forbiddenGlobal,
		fetch: forbiddenGlobal
	};
	const allowedWindowProperties = Reflect.ownKeys(windowTarget);
	const windowObject = guardedInterface(windowTarget, allowedWindowProperties, "window");
	const sandbox = {
		window: windowObject,
		addEventListener: forbiddenGlobal,
		removeEventListener: forbiddenGlobal,
		setInterval: forbiddenGlobal,
		clearInterval: forbiddenGlobal,
		setTimeout: forbiddenGlobal,
		clearTimeout: forbiddenGlobal,
		queueMicrotask: forbiddenGlobal,
		requestAnimationFrame: forbiddenGlobal,
		cancelAnimationFrame: forbiddenGlobal,
		requestIdleCallback: forbiddenGlobal,
		cancelIdleCallback: forbiddenGlobal,
		Worker: forbiddenGlobal,
		WebSocket: forbiddenGlobal,
		EventSource: forbiddenGlobal,
		BroadcastChannel: forbiddenGlobal,
		fetch: forbiddenGlobal
	};
	const sandboxSnapshot = new Map(Reflect.ownKeys(sandbox).map((key) => [key, sandbox[key]]));
	const assertNoGlobalMutation = () => {
		assert.deepEqual(Reflect.ownKeys(sandbox).sort(), Array.from(sandboxSnapshot.keys()).sort());
		for (const [key, value] of sandboxSnapshot) assert.equal(sandbox[key], value, `global changed: ${String(key)}`);
		assert.deepEqual(Reflect.ownKeys(windowTarget).sort(), Array.from(allowedWindowProperties).sort());
		for (const key of allowedWindowProperties) assert.equal(windowTarget[key], key === "__ModuleLoader__" ? moduleLoader : forbiddenGlobal);
		assert.deepEqual(Reflect.ownKeys(moduleLoaderTarget), ["load"]);
		assert.equal(moduleLoaderTarget.load.name, "load");
	};

	vm.runInNewContext(source, sandbox, { filename: "src/client.js" });

	assertNoGlobalMutation();
	assert.equal(loadCalls.length, 1);
	assert.equal(loadCalls[0].id, PACKAGE_ID);
	assert.deepEqual(Object.keys(loadCalls[0]).sort(), ["factory", "id"]);
	assert.equal(typeof loadCalls[0].factory, "function");

	const requiredModules = [];
	const client = loadCalls[0].factory((moduleId) => {
		requiredModules.push(moduleId);
		if (moduleId === "react/jsx-runtime") return { jsx };
		throw new Error(`unexpected shared module: ${moduleId}`);
	});

	assertNoGlobalMutation();
	assert.deepEqual(requiredModules, ["react/jsx-runtime"]);
	assert.deepEqual(Object.keys(client).sort(), ["apply", "inject", "name"]);
	assert.equal(client.name, "dsh-embedded-workbench");
	assert.deepEqual(Array.from(client.inject), ["slots"]);

	let effectCalls = 0;
	let injectCalls = 0;
	let registerCalls = 0;
	let cleanupCalls = 0;
	let effectLabel;
	let sectionMetadata;
	let renderSection;
	let cleanup;
	const lifecycle = [];
	const slots = guardedInterface({
		inject(slotName, registerSection) {
			lifecycle.push("inject");
			injectCalls += 1;
			assert.equal(slotName, "settings.section");
			return registerSection();
		},
		register(metadata, render) {
			lifecycle.push("register");
			registerCalls += 1;
			sectionMetadata = metadata;
			renderSection = render;
			return () => {
				cleanupCalls += 1;
			};
		}
	}, ["inject", "register"], "slots");
	const ctx = guardedInterface({
		effect(effect, label) {
			lifecycle.push("effect");
			effectCalls += 1;
			effectLabel = label;
			cleanup = effect();
		},
		slots
	}, ["effect", "slots"], "ctx");

	assert.equal(client.apply(ctx), undefined);
	assertNoGlobalMutation();
	assert.equal(effectCalls, 1);
	assert.equal(injectCalls, 1);
	assert.equal(registerCalls, 1);
	assert.deepEqual(lifecycle, ["effect", "inject", "register"]);
	assert.equal(effectLabel, "dsh-embedded-workbench: settings section");
	assert.deepEqual(Object.keys(sectionMetadata).sort(), ["id", "label", "name", "order"]);
	assert.equal(sectionMetadata.name, "settings.section");
	assert.equal(sectionMetadata.id, "dsh-embedded-workbench");
	assert.equal(sectionMetadata.order, 200);
	assert.equal(typeof sectionMetadata.label, "function");
	assert.equal(sectionMetadata.label(), SECTION_LABEL);
	assertNoGlobalMutation();

	const rendered = renderSection({});
	assertNoGlobalMutation();
	assert.equal(rendered.type, "section");
	assert.deepEqual(Object.keys(rendered.props), ["children"]);
	assert.deepEqual(Array.from(rendered.props.children, (node) => node.type), ["h2", "p"]);
	assert.deepEqual(Array.from(rendered.props.children, (node) => Object.keys(node.props)), [["children"], ["children"]]);
	assert.equal(rendered.props.children[0].props.children, SECTION_LABEL);
	assert.equal(rendered.props.children[1].props.children, "M0 插件已加载。更多嵌入式能力将在后续里程碑提供。");

	assert.equal(typeof cleanup, "function");
	cleanup();
	assertNoGlobalMutation();
	assert.equal(cleanupCalls, 1);
});
