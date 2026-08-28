import assert from "node:assert/strict";
import test from "node:test";

import type { WorkbenchSettings, WorkbenchSnapshot } from "@dsh-embedded/workbench-contracts";
import { WorkbenchUiController } from "../src/controller.js";

type Listener = () => void;

function snapshot(phase: "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" = "RUNNING"): WorkbenchSnapshot {
	return {
		health: "READY",
		capabilities: [{
			capability_id: "reference.lifecycle",
			display_name: "Reference Lifecycle",
			provider_version: "0.0.0",
			contract_version: "1.0.0",
			required: false,
			desired_enabled: true,
			availability: "AVAILABLE",
			phase,
			apply_mode: "LIVE",
			error: null,
			revision: 1,
			updated_at: "2026-08-28T00:00:00.000Z"
		}]
	};
}

class FakeScope {
	#value: WorkbenchSettings | undefined;
	#writable = true;
	#listeners = new Set<Listener>();
	readonly writes: Array<{ field: string; value: unknown }> = [];
	unsetCalls = 0;
	#rejectNextWrite = false;

	constructor(value: WorkbenchSettings | undefined = { capabilities: { "reference.lifecycle": { enabled: true }, other: { enabled: false } } }) {
		this.#value = value;
	}

	getSnapshot() {
		return { status: "ready" as const, value: this.#value, writable: this.#writable };
	}

	subscribe(listener: Listener) {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	async set(field: string, value: unknown) {
		this.writes.push({ field, value });
		if (!this.#rejectNextWrite) this.#value = { ...(this.#value ?? { capabilities: {} }), [field]: value } as WorkbenchSettings;
		this.#rejectNextWrite = false;
		this.#emit();
	}

	async unset(field: string) {
		this.unsetCalls += 1;
		if (this.#value !== undefined) {
			const next = { ...this.#value } as Record<string, unknown>;
			delete next[field];
			this.#value = next as WorkbenchSettings;
		}
		this.#emit();
	}

	rejectLatestWrite() {
		this.#value = { capabilities: { "reference.lifecycle": { enabled: false } } };
		this.#rejectNextWrite = true;
		this.#emit();
	}

	get listenerCount() { return this.#listeners.size; }

	#emit() { for (const listener of this.#listeners) listener(); }
}

class FakeClock {
	#next = 0;
	readonly tasks = new Map<number, () => void>();

	schedule(callback: () => void, milliseconds: number) {
		assert.equal(milliseconds, 500);
		const id = ++this.#next;
		this.tasks.set(id, callback);
		return id;
	}

	cancel(id: number) { this.tasks.delete(id); }

	async tick() {
		const [id, callback] = this.tasks.entries().next().value ?? [];
		if (id === undefined) return;
		this.tasks.delete(id);
		callback();
		await new Promise<void>(resolve => queueMicrotask(resolve));
		await new Promise<void>(resolve => queueMicrotask(resolve));
	}
}

function fixture(phase: "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" = "RUNNING") {
	const scope = new FakeScope();
	const clock = new FakeClock();
	const calls: string[] = [];
	const resets = new Set<Listener>();
	const remote = {
		workbenchCapabilities: {
			async list() { calls.push("list"); return { ok: true as const, value: snapshot(phase) }; },
			async reconcile(capabilityId: string) { calls.push(`reconcile:${capabilityId}`); return { ok: true as const, value: snapshot(phase).capabilities[0] }; },
			async retry(capabilityId: string) { calls.push(`retry:${capabilityId}`); return { ok: true as const, value: snapshot(phase).capabilities[0] }; }
		}
	};
	const controller = new WorkbenchUiController({
		remote,
		scope,
		subscribeConnectionReset(listener) { resets.add(listener); return () => resets.delete(listener); },
		clock
	});
	return { controller, scope, clock, calls, resets };
}

test("Controller refreshes on open, bounds transient polling, and clears resources on dispose", async () => {
	const { controller, scope, clock, calls, resets } = fixture("STARTING");
	await controller.start();
	assert.deepEqual(calls, ["list"]);
	assert.equal(clock.tasks.size, 1);
	assert.equal(scope.listenerCount, 1);
	assert.equal(resets.size, 1);

	for (let index = 0; index < 20; index += 1) await clock.tick();
	assert.equal(calls.filter(call => call === "list").length, 21);
	assert.equal(clock.tasks.size, 0);

	await controller.dispose();
	assert.equal(clock.tasks.size, 0);
	assert.equal(scope.listenerCount, 0);
	assert.equal(resets.size, 0);
});

test("setEnabled clones the latest capabilities, reconciles one ID, and refreshes", async () => {
	const { controller, scope, calls } = fixture();
	await controller.start();
	await controller.setEnabled("reference.lifecycle", false);

	assert.deepEqual(scope.writes, [{
		field: "capabilities",
		value: { "reference.lifecycle": { enabled: false }, other: { enabled: false } }
	}]);
	assert.deepEqual(calls, ["list", "list", "reconcile:reference.lifecycle", "list"]);
	await controller.dispose();
});

test("recovered Settings conflicts retain the Host value and do not reconcile a discarded draft", async () => {
	const { controller, scope, calls } = fixture();
	await controller.start();
	scope.rejectLatestWrite();
	await controller.setEnabled("reference.lifecycle", true);

	assert.equal(calls.includes("reconcile:reference.lifecycle"), false);
	assert.equal(controller.getSnapshot().error?.stage, "settings");
	assert.match(controller.getSnapshot().error?.message ?? "", /Host retained/);
	await controller.dispose();
});

test("retry, reconcile, Settings change, and connection reset each refresh without preserving history", async () => {
	const { controller, scope, calls, resets } = fixture();
	await controller.start();
	await controller.retry("reference.lifecycle");
	await controller.reconcile("reference.lifecycle");
	await scope.set("capabilities", { "reference.lifecycle": { enabled: true } });
	await new Promise<void>(resolve => setImmediate(resolve));
	for (const reset of resets) reset();
	await new Promise<void>(resolve => setImmediate(resolve));

	assert.deepEqual(calls, [
		"list", "retry:reference.lifecycle", "list", "reconcile:reference.lifecycle", "list", "list", "list"
	]);
	assert.equal(controller.getSnapshot().history, undefined);
	await controller.dispose();
});
