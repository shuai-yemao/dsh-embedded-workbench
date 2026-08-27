import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchLifecycle } from "../src/workbench-lifecycle.js";

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function makeDeadline() {
	let callback;
	let cancelled = false;
	return {
		schedule(nextCallback, milliseconds) {
			assert.equal(milliseconds, 1000);
			callback = nextCallback;
			return { cancel: () => { cancelled = true; } };
		},
		fire() {
			assert.equal(typeof callback, "function");
			callback();
		},
		get cancelled() {
			return cancelled;
		}
	};
}

test("lifecycle follows normal state transitions and cleanup order", async () => {
	const events = [];
	const lifecycle = createWorkbenchLifecycle({
		resources: [
			async () => () => events.push("A"),
			async () => () => events.push("B"),
			async () => () => events.push("C")
		]
	});

	assert.equal(lifecycle.snapshot().state, "CREATED");
	await lifecycle.start();
	assert.equal(lifecycle.snapshot().state, "RUNNING");
	await lifecycle.dispose();
	assert.equal(lifecycle.snapshot().state, "STOPPED");
	assert.deepEqual(events.slice(0, 3), ["C", "B", "A"]);
	assert.equal(lifecycle.snapshot().remaining_resource_count, 0);
});

test("instances are isolated and terminal instances cannot restart", async () => {
	const first = createWorkbenchLifecycle({ resources: [] });
	const second = createWorkbenchLifecycle({ resources: [] });
	assert.notEqual(first.snapshot().instance_id, second.snapshot().instance_id);
	await first.start();
	await first.dispose();
	await assert.rejects(first.start(), error => error.code === "LIFECYCLE_TERMINAL");
});

test("startup failure rolls back acquired resources and preserves root error", async () => {
	const events = [];
	const rootError = new Error("B failed");
	const lifecycle = createWorkbenchLifecycle({
		resources: [
			async () => () => events.push("A"),
			async () => { throw rootError; },
			async () => () => events.push("C")
		]
	});

	await assert.rejects(lifecycle.start(), error => error === rootError);
	assert.equal(lifecycle.snapshot().state, "FAILED");
	assert.deepEqual(events, ["A"]);
	assert.equal(lifecycle.snapshot().startup_error.message, "B failed");
});

test("cleanup errors are aggregated while every disposer is attempted once", async () => {
	const events = [];
	const lifecycle = createWorkbenchLifecycle({
		resources: [
			async () => () => events.push("A"),
			async () => () => { events.push("B"); throw new Error("B cleanup"); },
			async () => () => events.push("C")
		]
	});

	await lifecycle.start();
	await assert.rejects(lifecycle.dispose());
	assert.equal(lifecycle.snapshot().state, "FAILED");
	assert.deepEqual(events, ["C", "B", "A"]);
	assert.equal(lifecycle.snapshot().cleanup_errors.length, 1);
	await assert.rejects(lifecycle.dispose());
	assert.deepEqual(events, ["C", "B", "A"]);
});

test("start and dispose return identical in-flight promises", async () => {
	const gate = deferred();
	const lifecycle = createWorkbenchLifecycle({
		resources: [async () => { await gate.promise; return () => {}; }]
	});

	const startOne = lifecycle.start();
	const startTwo = lifecycle.start();
	assert.equal(startOne, startTwo);
	gate.resolve();
	await startOne;
	const disposeOne = lifecycle.dispose();
	const disposeTwo = lifecycle.dispose();
	assert.equal(disposeOne, disposeTwo);
	await disposeOne;
});

test("dispose during STARTING prevents RUNNING without a deadlock", async () => {
	const gate = deferred();
	const lifecycle = createWorkbenchLifecycle({
		resources: [async () => { await gate.promise; return () => {}; }]
	});
	const startPromise = lifecycle.start();
	const disposePromise = lifecycle.dispose();
	gate.resolve();
	await Promise.allSettled([startPromise, disposePromise]);
	assert.notEqual(lifecycle.snapshot().state, "RUNNING");
	assert.ok(["STOPPED", "FAILED"].includes(lifecycle.snapshot().state));
});

test("cleanup timeout keeps residual diagnostics and observes late rejection", async () => {
	const deadline = makeDeadline();
	const late = deferred();
	const lifecycle = createWorkbenchLifecycle({
		resources: [async () => () => late.promise],
		cleanupTimeoutMs: 1000,
		deadline
	});

	await lifecycle.start();
	const disposePromise = lifecycle.dispose();
	await new Promise(resolve => setImmediate(resolve));
	deadline.fire();
	await assert.rejects(disposePromise, error => error.code === "LIFECYCLE_CLEANUP_TIMEOUT");
	assert.equal(lifecycle.snapshot().state, "FAILED");
	assert.equal(lifecycle.snapshot().cleanup_complete, false);
	assert.equal(lifecycle.snapshot().remaining_resource_count, 1);
	late.reject(new Error("late cleanup"));
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(deadline.cancelled, false);
});

test("snapshot is JSON-safe and does not expose runtime handles", () => {
	const lifecycle = createWorkbenchLifecycle({ resources: [] });
	const snapshot = lifecycle.snapshot();
	assert.doesNotThrow(() => JSON.stringify(snapshot));
	assert.equal(snapshot.ctx, undefined);
	assert.equal(snapshot.fiber, undefined);
	assert.equal(snapshot.promise, undefined);
	assert.equal(snapshot.disposers, undefined);
});
