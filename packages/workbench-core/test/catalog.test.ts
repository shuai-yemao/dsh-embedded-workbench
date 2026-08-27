import assert from "node:assert/strict";
import test from "node:test";

import type { ProviderDescriptor } from "@dsh-embedded/workbench-contracts";

import { CapabilityCatalog } from "../src/catalog.ts";

const descriptors: readonly ProviderDescriptor[] = [
    {
        capability_id: "fixture.alpha",
        package_name: "@fixture/alpha",
        display_name: "Alpha",
        required: false,
        expected_provider_version: "0.0.0",
        supported_contract_major: 1,
        default_enabled: true,
    },
    {
        capability_id: "fixture.beta",
        package_name: "@fixture/beta",
        display_name: "Beta",
        required: false,
        expected_provider_version: "0.0.0",
        supported_contract_major: 1,
        default_enabled: false,
    },
];

test("catalog bounds state to descriptors and advances only the updated revision", () => {
    let tick = 0;
    const catalog = new CapabilityCatalog(descriptors, () => new Date(`2026-08-28T00:00:0${tick++}.000Z`));
    const betaBefore = catalog.snapshot("fixture.beta");

    const alpha = catalog.update("fixture.alpha", {
        availability: "AVAILABLE",
        phase: "RUNNING",
        provider_version: "0.0.0",
        contract_version: "1.0.0",
    });
    const betaAfter = catalog.snapshot("fixture.beta");

    assert.equal(alpha.revision, 1);
    assert.equal(alpha.updated_at, "2026-08-28T00:00:02.000Z");
    assert.equal(Object.isFrozen(alpha), true);
    assert.deepEqual(betaAfter, betaBefore);
    assert.equal(catalog.snapshotAll().health, "READY");
    assert.throws(() => catalog.snapshot("fixture.missing"), /Unknown capability/i);
});

test("catalog health considers only enabled capabilities", () => {
    const catalog = new CapabilityCatalog(descriptors, () => new Date("2026-08-28T00:00:00.000Z"));
    catalog.update("fixture.alpha", {
        availability: "AVAILABLE",
        phase: "RUNNING",
        provider_version: "0.0.0",
        contract_version: "1.0.0",
    });
    assert.equal(catalog.snapshotAll().health, "READY");

    catalog.update("fixture.beta", { desired_enabled: true });
    assert.equal(catalog.snapshotAll().health, "DEGRADED");
});

test("catalog rejects duplicate descriptor IDs", () => {
    assert.throws(
        () => new CapabilityCatalog([descriptors[0]!, descriptors[0]!]),
        /Duplicate capability_id/i,
    );
});
