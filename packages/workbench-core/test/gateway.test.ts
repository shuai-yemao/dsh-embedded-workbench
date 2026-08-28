import assert from "node:assert/strict";
import test from "node:test";

import { Context } from "@deepseek-ai/cordis";
import { remoteMethods } from "@deepseek-ai/dsh-typert-protocol";
import type { CapabilitySnapshot, WorkbenchSnapshot } from "@dsh-embedded/workbench-contracts";

import { WorkbenchCapabilitiesGateway, type CapabilityGatewayController } from "../src/gateway.ts";

const capability: CapabilitySnapshot = {
    capability_id: "fixture.alpha",
    display_name: "Alpha",
    provider_version: "0.0.0",
    contract_version: "1.0.0",
    required: false,
    desired_enabled: true,
    availability: "AVAILABLE",
    phase: "RUNNING",
    apply_mode: "LIVE",
    error: null,
    revision: 1,
    updated_at: "2026-08-28T00:00:00.000Z",
};

function gatewayFixture(): { readonly gateway: WorkbenchCapabilitiesGateway; readonly calls: string[] } {
    const calls: string[] = [];
    const controller: CapabilityGatewayController = {
        snapshot(capabilityId) {
            calls.push(`snapshot:${capabilityId}`);
            if (capabilityId !== capability.capability_id) throw new RangeError("Unknown capability_id");
            return capability;
        },
        snapshotAll() {
            calls.push("list");
            return { health: "READY", capabilities: [capability] };
        },
        async retry(capabilityId) {
            calls.push(`retry:${capabilityId}`);
            return capability;
        },
        async reconcile(capabilityId) {
            calls.push(`reconcile:${capabilityId}`);
            return capability;
        },
    };
    return { gateway: new WorkbenchCapabilitiesGateway(new Context(), controller), calls };
}

test("Gateway exposes exactly the fixed workbenchCapabilities Remote methods", () => {
    const { gateway } = gatewayFixture();

    assert.equal(gateway.typertRemote.namespace, "workbenchCapabilities");
    assert.deepEqual(remoteMethods(gateway), [
        { method: "list", invocation: { kind: "direct" } },
        { method: "retry", invocation: { kind: "direct" } },
        { method: "reconcile", invocation: { kind: "direct" } },
    ]);
});

test("Gateway validates the capability before retry or reconcile and returns frozen snapshots", async () => {
    const { gateway, calls } = gatewayFixture();

    const list = await gateway.list();
    assert.equal(Object.isFrozen(list), true);
    assert.equal(Object.isFrozen(list.capabilities), true);
    assert.equal(Object.isFrozen((list as WorkbenchSnapshot).capabilities[0]), true);

    await assert.rejects(() => gateway.retry("fixture.missing"), /Unknown capability/i);
    assert.deepEqual(calls, ["list", "snapshot:fixture.missing"]);

    const reconciled = await gateway.reconcile("fixture.alpha");
    assert.equal(Object.isFrozen(reconciled), true);
    assert.deepEqual(calls, ["list", "snapshot:fixture.missing", "snapshot:fixture.alpha", "reconcile:fixture.alpha"]);
});
