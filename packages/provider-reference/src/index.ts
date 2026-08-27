import type { Context } from "@deepseek-ai/cordis";

import {
    WORKBENCH_CONTRACT_VERSION,
    assertProviderManifest,
    type ProviderManifest,
} from "@dsh-embedded/workbench-contracts";

import {
    assertReferenceFailureMode,
    createReferenceLifecycle,
    type ReferenceFailureMode,
} from "./lifecycle.js";

export interface ReferenceProviderConfig {
    readonly failure?: ReferenceFailureMode;
}

export const manifest: Readonly<ProviderManifest> = assertProviderManifest({
    capability_id: "reference.lifecycle",
    display_name: "Reference Lifecycle",
    provider_version: "0.0.0",
    contract_version: WORKBENCH_CONTRACT_VERSION,
    apply_mode: "LIVE",
});

export const inject: readonly string[] = [];

function assertReferenceProviderConfig(value: unknown): ReferenceProviderConfig {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Reference provider config must be an object");
    }
    const config = value as Record<string, unknown>;
    for (const key of Object.keys(config)) {
        if (key !== "failure") {
            throw new TypeError(`Reference provider config has unexpected field: ${key}`);
        }
    }
    if (config.failure !== undefined) assertReferenceFailureMode(config.failure);
    return config as ReferenceProviderConfig;
}

export async function apply(
    _ctx: Context,
    config: ReferenceProviderConfig = {},
): Promise<() => Promise<void>> {
    const validatedConfig = assertReferenceProviderConfig(config);
    const lifecycle = createReferenceLifecycle({ failure: validatedConfig.failure ?? "none" });
    await lifecycle.start();
    return async () => {
        await lifecycle.dispose();
    };
}

export default Object.freeze({ inject, apply });
