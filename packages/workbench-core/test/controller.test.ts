import assert from "node:assert/strict";
import test from "node:test";

import { Context, type Plugin } from "@deepseek-ai/cordis";
import type {
    ProviderDescriptor,
    ProviderManifest,
} from "@dsh-embedded/workbench-contracts";

import { CapabilityCatalog } from "../src/catalog.ts";
import { CapabilityController, type ProviderResolver } from "../src/controller.ts";

const descriptors: readonly ProviderDescriptor[] = [
    {
        capability_id: "fixture.fail-start",
        package_name: "@fixture/fail-start",
        display_name: "Fail Start",
        required: false,
        expected_provider_version: "0.0.0",
        supported_contract_major: 1,
        default_enabled: true,
    },
    {
        capability_id: "fixture.healthy",
        package_name: "@fixture/healthy",
        display_name: "Healthy",
        required: false,
        expected_provider_version: "0.0.0",
        supported_contract_major: 1,
        default_enabled: true,
    },
];

function moduleFor(descriptor: ProviderDescriptor, plugin: Plugin) {
    const manifest: ProviderManifest = {
        capability_id: descriptor.capability_id,
        display_name: descriptor.display_name,
        provider_version: "0.0.0",
        contract_version: "1.0.0",
        apply_mode: "LIVE",
    };
    return {
        availability: "AVAILABLE" as const,
        manifest,
        module: { manifest, plugin },
        error: null,
    };
}

test("provider A failure does not stop provider B", async () => {
    const context = new Context();
    const catalog = new CapabilityCatalog(descriptors);
    const lifecycle: string[] = [];
    const resolver: ProviderResolver = {
        async resolve(descriptor) {
            if (descriptor.capability_id === "fixture.fail-start") {
                return moduleFor(descriptor, {
                    apply: async () => { throw new Error("fixture start failure"); },
                });
            }
            return moduleFor(descriptor, {
                apply: async () => {
                    lifecycle.push("healthy-start");
                    return async () => { lifecycle.push("healthy-stop"); };
                },
            });
        },
    };
    const controller = new CapabilityController({ context, catalog, descriptors, resolver });

    const [failed, healthy] = await Promise.allSettled([
        controller.reconcile("fixture.fail-start"),
        controller.reconcile("fixture.healthy"),
    ]);
    assert.equal(failed.status, "rejected");
    assert.equal(healthy.status, "fulfilled");
    assert.equal(controller.snapshot("fixture.fail-start").phase, "FAILED");
    assert.equal(controller.snapshot("fixture.healthy").phase, "RUNNING");

    await controller.dispose();
    assert.deepEqual(lifecycle, ["healthy-start", "healthy-stop"]);
});

test("rapid desired changes converge to the latest state without duplicate fibers", async () => {
    const descriptor = descriptors[1]!;
    const context = new Context();
    const catalog = new CapabilityCatalog([descriptor]);
    let starts = 0;
    let stops = 0;
    const resolver: ProviderResolver = {
        async resolve(value) {
            return moduleFor(value, {
                apply: async () => {
                    starts += 1;
                    return async () => { stops += 1; };
                },
            });
        },
    };
    const controller = new CapabilityController({ context, catalog, descriptors: [descriptor], resolver });

    await controller.reconcile(descriptor.capability_id);
    const disable = controller.setDesiredEnabled(descriptor.capability_id, false);
    const enable = controller.setDesiredEnabled(descriptor.capability_id, true);
    assert.equal(disable, enable);
    await enable;
    assert.equal(controller.snapshot(descriptor.capability_id).phase, "RUNNING");
    assert.equal(starts, 2);
    assert.equal(stops, 1);

    await controller.dispose();
    assert.equal(stops, 2);
});

test("cleanup failure requires restart and rejects local retry", async () => {
    const descriptor = descriptors[1]!;
    const context = new Context();
    const catalog = new CapabilityCatalog([descriptor]);
    const resolver: ProviderResolver = {
        async resolve(value) {
            return moduleFor(value, {
                apply: async () => async () => { throw new Error("fixture cleanup failure"); },
            });
        },
    };
    const controller = new CapabilityController({ context, catalog, descriptors: [descriptor], resolver });

    await controller.reconcile(descriptor.capability_id);
    await assert.rejects(
        controller.setDesiredEnabled(descriptor.capability_id, false),
        /cleanup/i,
    );
    const failed = controller.snapshot(descriptor.capability_id);
    assert.equal(failed.phase, "FAILED");
    assert.equal(failed.apply_mode, "RESTART_REQUIRED");
    await assert.rejects(controller.retry(descriptor.capability_id), /restart required/i);
    await assert.rejects(
        controller.setDesiredEnabled(descriptor.capability_id, true),
        /restart required/i,
    );
});
