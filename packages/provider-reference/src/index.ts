import type { Context } from "@deepseek-ai/cordis";

import {
    WORKBENCH_CONTRACT_VERSION,
    assertProviderManifest,
    type ProviderManifest,
} from "@dsh-embedded/workbench-contracts";

import {
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

export async function apply(
    _ctx: Context,
    config: ReferenceProviderConfig = {},
): Promise<() => Promise<void>> {
    const lifecycle = createReferenceLifecycle({ failure: config.failure ?? "none" });
    await lifecycle.start();
    return async () => {
        await lifecycle.dispose();
    };
}

export default Object.freeze({ inject, apply });
