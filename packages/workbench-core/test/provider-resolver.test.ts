import assert from "node:assert/strict";
import test from "node:test";

import type { ProviderDescriptor, ProviderManifest } from "@dsh-embedded/workbench-contracts";

import { resolveProvider, type ProviderPackageManifest } from "../src/provider-resolver.ts";

const descriptor: ProviderDescriptor = {
    capability_id: "reference.lifecycle",
    package_name: "@dsh-embedded/provider-reference",
    display_name: "Reference Lifecycle",
    required: false,
    expected_provider_version: "0.0.0",
    supported_contract_major: 1,
    default_enabled: true,
};

const providerManifest: ProviderManifest = {
    capability_id: "reference.lifecycle",
    display_name: "Reference Lifecycle",
    provider_version: "0.0.0",
    contract_version: "1.0.0",
    apply_mode: "LIVE",
};

function packageManifest(provider: ProviderManifest = providerManifest): ProviderPackageManifest {
    return {
        name: descriptor.package_name,
        version: "0.0.0",
        dshEmbedded: { provider },
        entry_url: "file:///fixture/provider.js",
    };
}

test("missing provider does not execute import", async () => {
    let imports = 0;
    const result = await resolveProvider(descriptor, {
        resolveManifest: async () => undefined,
        importModule: async () => { imports += 1; return { manifest: providerManifest }; },
    });

    assert.equal(result.availability, "MISSING");
    assert.equal(result.error?.code, "CAPABILITY_MISSING");
    assert.equal(imports, 0);
});

test("incompatible provider code is never imported", async () => {
    let imports = 0;
    const result = await resolveProvider(descriptor, {
        resolveManifest: async () => packageManifest({ ...providerManifest, contract_version: "2.0.0" }),
        importModule: async () => { imports += 1; return { manifest: providerManifest }; },
    });

    assert.equal(result.availability, "INCOMPATIBLE");
    assert.equal(result.error?.code, "CAPABILITY_CONTRACT_INCOMPATIBLE");
    assert.equal(imports, 0);
});

test("provider version mismatch is rejected before import", async () => {
    let imports = 0;
    const result = await resolveProvider(descriptor, {
        resolveManifest: async () => ({
            ...packageManifest(),
            version: "0.0.1",
        }),
        importModule: async () => { imports += 1; return { manifest: providerManifest }; },
    });

    assert.equal(result.availability, "INCOMPATIBLE");
    assert.equal(result.error?.code, "CAPABILITY_PROVIDER_VERSION_MISMATCH");
    assert.equal(imports, 0);
});

test("matching static and module manifests become available after one import", async () => {
    let imports = 0;
    const result = await resolveProvider(descriptor, {
        resolveManifest: async () => packageManifest(),
        importModule: async () => {
            imports += 1;
            return { manifest: providerManifest, apply: () => undefined };
        },
    });

    assert.equal(result.availability, "AVAILABLE");
    assert.equal(result.error, null);
    assert.equal(result.module?.manifest.capability_id, descriptor.capability_id);
    assert.equal(imports, 1);
});

test("manifest drift is blocked after import without exposing the module", async () => {
    const result = await resolveProvider(descriptor, {
        resolveManifest: async () => packageManifest(),
        importModule: async () => ({ manifest: { ...providerManifest, display_name: "Drifted" } }),
    });

    assert.equal(result.availability, "BLOCKED");
    assert.equal(result.error?.code, "CAPABILITY_MANIFEST_DRIFT");
    assert.equal(result.module, null);
});
