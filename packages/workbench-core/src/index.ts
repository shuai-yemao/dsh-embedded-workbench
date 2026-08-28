import type { Context } from "@deepseek-ai/cordis";
import type { SettingsProvider } from "@deepseek-ai/dsh-settings";
import type { Plugin } from "@deepseek-ai/cordis";
import type { ProviderDescriptor } from "@dsh-embedded/workbench-contracts";

import { CapabilityCatalog } from "./catalog.js";
import { CapabilityController } from "./controller.js";
import { WorkbenchCapabilitiesGateway } from "./gateway.js";
import { createNodeProviderResolver } from "./provider-resolver.js";
import { createWorkbenchSettingsOwner } from "./settings.js";

export * from "./catalog.js";
export * from "./controller.js";
export * from "./gateway.js";
export * from "./operation-gate.js";
export * from "./provider-resolver.js";
export * from "./settings.js";

export interface WorkbenchCoreConfig {
    readonly descriptors: readonly ProviderDescriptor[];
    readonly packageBaseUrl: string;
}

export const inject = ["settings"] as const;

function assertCoreConfig(value: unknown): WorkbenchCoreConfig {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Workbench Core config must be an object");
    }
    const config = value as Record<string, unknown>;
    if (!Array.isArray(config.descriptors) || typeof config.packageBaseUrl !== "string" || config.packageBaseUrl.length === 0) {
        throw new TypeError("Workbench Core config requires descriptors and packageBaseUrl");
    }
    return config as unknown as WorkbenchCoreConfig;
}

/** Core composition root: Settings owns desired state; Controller owns every Fiber. */
export async function apply(context: Context, value: unknown): Promise<() => Promise<void>> {
    const config = assertCoreConfig(value);
    const catalog = new CapabilityCatalog(config.descriptors);
    const controller = new CapabilityController({
        context,
        catalog,
        descriptors: config.descriptors,
        resolver: createNodeProviderResolver(config.packageBaseUrl),
    });
    const settings = createWorkbenchSettingsOwner({
        registrar: context.settings as SettingsProvider,
        controller,
        descriptors: config.descriptors,
    });
    new WorkbenchCapabilitiesGateway(context, controller);

    await settings.reconcileInitial();
    return async () => {
        settings.dispose();
        await controller.dispose();
    };
}

const workbenchCore: Plugin.Object<WorkbenchCoreConfig> = Object.freeze({ inject, apply });

export default workbenchCore;
