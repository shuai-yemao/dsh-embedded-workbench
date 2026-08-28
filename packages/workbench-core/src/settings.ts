import Schema from "@deepseek-ai/schemastery";
import type {
    SettingsNamespace,
    SettingsRegisterOptions,
    SettingsScope,
} from "@deepseek-ai/dsh-settings";
import {
    WORKBENCH_SETTINGS_NAMESPACE,
    type ProviderDescriptor,
    type WorkbenchSettings,
} from "@dsh-embedded/workbench-contracts";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";

/** The only surface Core needs from the public rc.2 Settings service. */
export interface WorkbenchSettingsRegistrar {
    register<T>(
        namespace: SettingsNamespace,
        schema: Schema<T>,
        options?: SettingsRegisterOptions<T>,
    ): SettingsScope<T>;
}

/** Controller boundary: Settings owns desired state, never Provider fibers. */
export interface DesiredEnabledController {
    setDesiredEnabled(capabilityId: string, enabled: boolean): Promise<unknown>;
    reportSettingsError(capabilityId: string, error: unknown): unknown;
}

export interface WorkbenchSettingsOwnerOptions {
    readonly registrar: WorkbenchSettingsRegistrar;
    readonly controller: DesiredEnabledController;
    readonly descriptors: readonly ProviderDescriptor[];
}

const WorkbenchSettingsSchema = Schema.object({
    capabilities: Schema.dict(Schema.object({ enabled: Schema.boolean() })).default({}),
}) as Schema<WorkbenchSettings>;

function settingsBase(descriptors: readonly ProviderDescriptor[]): WorkbenchSettings {
    const capabilities: Record<string, { enabled: boolean }> = {};
    for (const descriptor of descriptors) {
        capabilities[descriptor.capability_id] = { enabled: descriptor.default_enabled };
    }
    return { capabilities };
}

function enabledFor(settings: WorkbenchSettings, capabilityId: string): boolean | undefined {
    return settings.capabilities[capabilityId]?.enabled;
}

export class WorkbenchSettingsOwner {
    readonly #scope: SettingsScope<WorkbenchSettings>;
    readonly #controller: DesiredEnabledController;
    readonly #descriptors: readonly ProviderDescriptor[];
    readonly #unwatch: () => void;

    constructor(options: WorkbenchSettingsOwnerOptions) {
        this.#controller = options.controller;
        this.#descriptors = options.descriptors;
        this.#scope = options.registrar.register(
            settingsNamespace(WORKBENCH_SETTINGS_NAMESPACE),
            WorkbenchSettingsSchema,
            { base: settingsBase(options.descriptors), applies: "live" },
        );
        this.#unwatch = this.#scope.watch(async (next, previous) => this.#applyChanged(next, previous));
    }

    current(): WorkbenchSettings {
        return this.#scope.get();
    }

    /** Reconciles the registered Settings snapshot when Core starts; it never writes Settings. */
    async reconcileInitial(): Promise<void> {
        const settings = this.current();
        for (const descriptor of this.#descriptors) {
            const enabled = enabledFor(settings, descriptor.capability_id);
            if (enabled === undefined) continue;
            await this.#setDesired(descriptor.capability_id, enabled);
        }
    }

    dispose(): void {
        this.#unwatch();
    }

    async #applyChanged(next: WorkbenchSettings, previous: WorkbenchSettings): Promise<void> {
        for (const descriptor of this.#descriptors) {
            const capabilityId = descriptor.capability_id;
            const enabled = enabledFor(next, capabilityId);
            if (enabled === undefined || enabled === enabledFor(previous, capabilityId)) continue;
            await this.#setDesired(capabilityId, enabled);
        }
    }

    async #setDesired(capabilityId: string, enabled: boolean): Promise<void> {
        try {
            await this.#controller.setDesiredEnabled(capabilityId, enabled);
        } catch (error) {
            this.#controller.reportSettingsError(capabilityId, error);
        }
    }
}

export function createWorkbenchSettingsOwner(options: WorkbenchSettingsOwnerOptions): WorkbenchSettingsOwner {
    return new WorkbenchSettingsOwner(options);
}
