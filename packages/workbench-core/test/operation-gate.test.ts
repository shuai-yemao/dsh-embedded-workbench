import assert from "node:assert/strict";
import test from "node:test";

import { OperationGate } from "../src/operation-gate.ts";

function deferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
    return { promise, resolve };
}

test("same capability shares one in-flight promise and drains the latest generation", async () => {
    const gate = new OperationGate<string>();
    const firstRun = deferred();
    const runs: number[] = [];
    const run = async (generation: number) => {
        runs.push(generation);
        if (runs.length === 1) await firstRun.promise;
        return `generation-${generation}`;
    };

    const first = gate.request(run);
    const second = gate.request(run);
    assert.equal(first, second);
    firstRun.resolve();

    assert.equal(await first, "generation-2");
    assert.deepEqual(runs, [1, 2]);
});

test("different capability gates run without a shared lock", async () => {
    const left = new OperationGate<string>();
    const right = new OperationGate<string>();
    const entered = deferred();
    let rightCompleted = false;

    const leftPromise = left.request(async () => {
        await entered.promise;
        return "left";
    });
    const rightPromise = right.request(async () => {
        rightCompleted = true;
        return "right";
    });

    assert.equal(await rightPromise, "right");
    assert.equal(rightCompleted, true);
    entered.resolve();
    assert.equal(await leftPromise, "left");
});
