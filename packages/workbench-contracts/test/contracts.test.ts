import assert from "node:assert/strict";
import test from "node:test";

import {
    WORKBENCH_CONTRACT_VERSION,
    WORKBENCH_SETTINGS_NAMESPACE,
    assertProviderManifest,
    freezeCapabilitySnapshot,
    freezeJsonSnapshot,
    freezeWorkbenchSnapshot,
    isContractCompatible,
    isProviderVersionExact,
} from "../src/index.ts";

test("contract compatibility is decided by a validated major version", () => {
    assert.equal(WORKBENCH_CONTRACT_VERSION, "1.0.0");
    assert.equal(WORKBENCH_SETTINGS_NAMESPACE, "dsh-embedded-workbench");
    assert.equal(isContractCompatible("1.0.0", 1), true);
    assert.equal(isContractCompatible("1.9.7", 1), true);
    assert.equal(isContractCompatible("2.0.0", 1), false);
    assert.throws(() => isContractCompatible("1", 1), /contract version/i);
    assert.throws(() => isContractCompatible("01.0.0", 1), /contract version/i);
    assert.throws(() => isContractCompatible("1.0.0", -1), /supported major/i);
});

test("JSON snapshots are cloned, deeply frozen, and free of runtime handles", () => {
    const source = {
        capability_id: "reference.lifecycle",
        nested: { values: ["RUNNING"] },
    };
    const snapshot = freezeJsonSnapshot(source);

    assert.notEqual(snapshot, source);
    assert.notEqual(snapshot.nested, source.nested);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.nested), true);
    assert.equal(Object.isFrozen(snapshot.nested.values), true);
    assert.equal(JSON.stringify(snapshot), '{"capability_id":"reference.lifecycle","nested":{"values":["RUNNING"]}}');
    assert.throws(() => freezeJsonSnapshot({ error: new Error("boom") }), /JSON-safe/i);
    assert.throws(() => freezeJsonSnapshot({ callback: () => undefined }), /JSON-safe/i);
    assert.throws(() => freezeJsonSnapshot({ value: Number.POSITIVE_INFINITY }), /JSON-safe/i);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    assert.throws(() => freezeJsonSnapshot(cyclic), /cyclic/i);
});

test("provider versions must be exact validated versions", () => {
    assert.equal(isProviderVersionExact("0.0.0", "0.0.0"), true);
    assert.equal(isProviderVersionExact("0.0.1", "0.0.0"), false);
    assert.throws(() => isProviderVersionExact("latest", "0.0.0"), /provider version/i);
    assert.throws(() => isProviderVersionExact("0.0.0", "^0.0.0"), /expected provider version/i);
});

const runningCapability = {
    capability_id: "reference.lifecycle",
    display_name: "Reference Lifecycle",
    provider_version: "0.0.0",
    contract_version: "1.0.0",
    required: false,
    desired_enabled: true,
    availability: "AVAILABLE",
    phase: "RUNNING",
    apply_mode: "LIVE",
    error: null,
    revision: 4,
    updated_at: "2026-08-27T12:00:00.000Z",
} as const;

test("capability snapshots reject unknown state values and mutable additions", () => {
    const snapshot = freezeCapabilitySnapshot(runningCapability);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(snapshot.phase, "RUNNING");
    assert.throws(
        () => freezeCapabilitySnapshot({ ...runningCapability, phase: "UNKNOWN" }),
        /phase/i,
    );
    assert.throws(
        () => freezeCapabilitySnapshot({ ...runningCapability, unexpected: true }),
        /unexpected field/i,
    );
});

test("workbench snapshots validate health and freeze their capability list", () => {
    const snapshot = freezeWorkbenchSnapshot({
        health: "READY",
        capabilities: [runningCapability],
    });
    assert.equal(Object.isFrozen(snapshot.capabilities), true);
    assert.equal(snapshot.capabilities[0]?.capability_id, "reference.lifecycle");
    assert.throws(
        () => freezeWorkbenchSnapshot({ health: "UNKNOWN", capabilities: [] }),
        /health/i,
    );
});

test("provider manifests expose only the stable contract", () => {
    const manifest = assertProviderManifest({
        capability_id: "reference.lifecycle",
        display_name: "Reference Lifecycle",
        provider_version: "0.0.0",
        contract_version: "1.0.0",
        apply_mode: "LIVE",
    });
    assert.equal(Object.isFrozen(manifest), true);
    assert.throws(
        () => assertProviderManifest({ ...manifest, apply_mode: "RESTART_REQUIRED" }),
        /apply_mode/i,
    );
});
