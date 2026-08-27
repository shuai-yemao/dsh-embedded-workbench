import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { apply, manifest } from "../src/index.ts";
import { createReferenceLifecycle } from "../src/lifecycle.ts";

function deferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function makeDeadline() {
    let callback: (() => void) | undefined;
    let cancelled = false;
    return {
        schedule(next: () => void, milliseconds: number) {
            assert.equal(milliseconds, 1000);
            callback = next;
            return { cancel: () => { cancelled = true; } };
        },
        fire() {
            assert.equal(typeof callback, "function");
            callback();
        },
        get cancelled() {
            return cancelled;
        },
    };
}

test("two reference instances never share resources", async () => {
    const left = createReferenceLifecycle({ failure: "none" });
    const right = createReferenceLifecycle({ failure: "none" });

    await Promise.all([left.start(), right.start()]);
    assert.notEqual(left.snapshot().instance_id, right.snapshot().instance_id);
    await left.dispose();
    assert.equal(left.snapshot().remaining_resource_count, 0);
    assert.equal(right.snapshot().state, "RUNNING");
    await right.dispose();
});

test("start failure rolls back only resources acquired by that instance", async () => {
    const events: string[] = [];
    const lifecycle = createReferenceLifecycle({
        failure: "start",
        resourceFactories: [
            async () => () => { events.push("first"); },
            async () => () => { events.push("second"); },
        ],
    });

    await assert.rejects(lifecycle.start(), /start failure/i);
    assert.deepEqual(events, ["first"]);
    assert.equal(lifecycle.snapshot().state, "FAILED");
    assert.equal(lifecycle.snapshot().remaining_resource_count, 0);
});

test("cleanup failure is aggregated after every disposer is attempted", async () => {
    const events: string[] = [];
    const lifecycle = createReferenceLifecycle({
        failure: "cleanup",
        resourceFactories: [
            async () => () => { events.push("first"); },
            async () => () => { events.push("second"); },
        ],
    });

    await lifecycle.start();
    await assert.rejects(lifecycle.dispose(), /cleanup failed/i);
    assert.deepEqual(events, ["second", "first"]);
    assert.equal(lifecycle.snapshot().state, "FAILED");
    assert.equal(lifecycle.snapshot().cleanup_errors.length, 1);
});

test("cleanup timeout preserves residual diagnostics and observes late rejection", async () => {
    const deadline = makeDeadline();
    const late = deferred();
    const lifecycle = createReferenceLifecycle({
        failure: "none",
        cleanupTimeoutMs: 1000,
        deadline,
        resourceFactories: [async () => () => late.promise],
    });

    await lifecycle.start();
    const disposePromise = lifecycle.dispose();
    await new Promise<void>((resolve) => setImmediate(resolve));
    deadline.fire();
    await assert.rejects(disposePromise, /deadline/i);
    assert.equal(lifecycle.snapshot().remaining_resource_count, 1);
    late.reject(new Error("late cleanup"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(lifecycle.snapshot().cleanup_errors.length, 1);
    assert.equal(deadline.cancelled, false);
});

test("provider manifest matches the import-before-execution package manifest", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    assert.deepEqual(manifest, packageJson.dshEmbedded.provider);
    assert.equal(Object.isFrozen(manifest), true);
});

test("Cordis apply starts one lifecycle and returns its disposer", async () => {
    const dispose = await apply({} as never, { failure: "none" });
    assert.equal(typeof dispose, "function");
    await dispose();
});

test("reference fixture configuration rejects unsupported modes and deadlines", async () => {
    assert.throws(
        () => createReferenceLifecycle({ failure: "invalid" as never }),
        /failure mode/i,
    );
    assert.throws(
        () => createReferenceLifecycle({ cleanupTimeoutMs: 500 }),
        /1000 ms/i,
    );
    await assert.rejects(
        apply({} as never, { failure: "invalid" } as never),
        /failure mode/i,
    );
    await assert.rejects(
        apply({} as never, { unexpected: true } as never),
        /unexpected field/i,
    );
});
