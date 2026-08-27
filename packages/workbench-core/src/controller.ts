import type { Context, Fiber, Plugin } from "@deepseek-ai/cordis";

import {
    freezeJsonSnapshot,
    type CapabilityErrorSnapshot,
    type CapabilitySnapshot,
    type ProviderDescriptor,
    type WorkbenchSnapshot,
} from "@dsh-embedded/workbench-contracts";

import { CapabilityCatalog } from "./catalog.js";
import { OperationGate } from "./operation-gate.js";
import type { ProviderResolution } from "./provider-resolver.js";

export interface ProviderResolver {
    resolve(descriptor: ProviderDescriptor): Promise<ProviderResolution>;
}

export interface CapabilityControllerOptions {
    readonly context: Context;
    readonly catalog: CapabilityCatalog;
    readonly descriptors: readonly ProviderDescriptor[];
    readonly resolver: ProviderResolver;
    readonly now?: () => Date;
}

interface RuntimeEntry {
    readonly descriptor: ProviderDescriptor;
    readonly gate: OperationGate<Readonly<CapabilitySnapshot>>;
    fiber: Fiber | undefined;
    cleanupFailure: unknown;
}

function defaultClock(): Date {
    return new Date();
}

function asError(
    code: string,
    stage: CapabilityErrorSnapshot["stage"],
    error: unknown,
    now: () => Date,
    suggestedAction: string,
): Readonly<CapabilityErrorSnapshot> {
    const message = error instanceof Error ? error.message : String(error);
    return freezeJsonSnapshot({
        code,
        stage,
        message,
        recoverable: true,
        suggested_action: suggestedAction,
        occurred_at: now().toISOString(),
    }) as Readonly<CapabilityErrorSnapshot>;
}

function restartRequiredError(now: () => Date): Error & { readonly code: string } {
    return Object.assign(
        new Error("Capability cleanup is incomplete; restart required"),
        { code: "CAPABILITY_RESTART_REQUIRED" },
    );
}

export class CapabilityController {
    readonly #context: Context;
    readonly #catalog: CapabilityCatalog;
    readonly #resolver: ProviderResolver;
    readonly #now: () => Date;
    readonly #entries = new Map<string, RuntimeEntry>();

    constructor(options: CapabilityControllerOptions) {
        this.#context = options.context;
        this.#catalog = options.catalog;
        this.#resolver = options.resolver;
        this.#now = options.now ?? defaultClock;
        for (const descriptor of options.descriptors) {
            if (this.#entries.has(descriptor.capability_id)) {
                throw new TypeError(`Duplicate capability_id: ${descriptor.capability_id}`);
            }
            this.#entries.set(descriptor.capability_id, {
                descriptor,
                gate: new OperationGate<Readonly<CapabilitySnapshot>>(),
                fiber: undefined,
                cleanupFailure: undefined,
            });
        }
    }

    snapshot(capabilityId: string): Readonly<CapabilitySnapshot> {
        this.#entry(capabilityId);
        return this.#catalog.snapshot(capabilityId);
    }

    snapshotAll(): Readonly<WorkbenchSnapshot> {
        return this.#catalog.snapshotAll();
    }

    setDesiredEnabled(capabilityId: string, enabled: boolean): Promise<Readonly<CapabilitySnapshot>> {
        this.#catalog.update(capabilityId, { desired_enabled: enabled });
        return this.reconcile(capabilityId);
    }

    reconcile(capabilityId: string): Promise<Readonly<CapabilitySnapshot>> {
        const entry = this.#entry(capabilityId);
        return entry.gate.request((generation) => this.#reconcile(entry, generation));
    }

    retry(capabilityId: string): Promise<Readonly<CapabilitySnapshot>> {
        const snapshot = this.snapshot(capabilityId);
        if (snapshot.apply_mode === "RESTART_REQUIRED") {
            return Promise.reject(restartRequiredError(this.#now));
        }
        return this.reconcile(capabilityId);
    }

    async dispose(): Promise<void> {
        const results = await Promise.allSettled(
            Array.from(this.#entries.values(), (entry) => entry.gate.request(() => this.#stop(entry))),
        );
        const failures = results
            .filter((result): result is PromiseRejectedResult => result.status === "rejected")
            .map((result) => result.reason);
        if (failures.length > 0) throw new AggregateError(failures, "Capability controller disposal failed");
    }

    #entry(capabilityId: string): RuntimeEntry {
        const entry = this.#entries.get(capabilityId);
        if (entry === undefined) throw new RangeError(`Unknown capability_id: ${capabilityId}`);
        return entry;
    }

    async #reconcile(entry: RuntimeEntry, _generation: number): Promise<Readonly<CapabilitySnapshot>> {
        const snapshot = this.#catalog.snapshot(entry.descriptor.capability_id);
        if (!snapshot.desired_enabled) {
            return this.#stop(entry);
        }
        if (snapshot.apply_mode === "RESTART_REQUIRED") throw restartRequiredError(this.#now);
        if (entry.fiber !== undefined && entry.fiber.uid !== null) {
            return snapshot;
        }
        entry.fiber = undefined;
        return this.#start(entry);
    }

    async #start(entry: RuntimeEntry): Promise<Readonly<CapabilitySnapshot>> {
        const capabilityId = entry.descriptor.capability_id;
        this.#catalog.update(capabilityId, { phase: "STARTING", error: null, apply_mode: "LIVE" });
        const resolution = await this.#resolver.resolve(entry.descriptor);
        if (resolution.availability !== "AVAILABLE" || resolution.manifest === null || resolution.module === null) {
            return this.#catalog.update(capabilityId, {
                availability: resolution.availability,
                phase: resolution.availability === "BLOCKED" ? "FAILED" : "STOPPED",
                provider_version: null,
                contract_version: null,
                error: resolution.error,
            });
        }

        let fiber: Fiber | undefined;
        try {
            entry.cleanupFailure = undefined;
            fiber = this.#context.plugin(this.#instrumentCleanup(resolution.module.plugin, entry));
            entry.fiber = fiber;
            await fiber.await();
            if (!this.#catalog.snapshot(capabilityId).desired_enabled) {
                return this.#stop(entry);
            }
            return this.#catalog.update(capabilityId, {
                availability: "AVAILABLE",
                phase: "RUNNING",
                provider_version: resolution.manifest.provider_version,
                contract_version: resolution.manifest.contract_version,
                apply_mode: resolution.manifest.apply_mode,
                error: null,
            });
        } catch (error) {
            if (fiber !== undefined && fiber.uid !== null) {
                await fiber.dispose().catch(() => undefined);
            }
            entry.fiber = undefined;
            this.#catalog.update(capabilityId, {
                availability: "AVAILABLE",
                phase: "FAILED",
                error: asError(
                    "CAPABILITY_START_FAILED",
                    "start",
                    error,
                    this.#now,
                    "检查 Provider 启动错误后手动重试",
                ),
            });
            throw error;
        }
    }

    async #stop(entry: RuntimeEntry): Promise<Readonly<CapabilitySnapshot>> {
        const capabilityId = entry.descriptor.capability_id;
        const fiber = entry.fiber;
        if (fiber === undefined || fiber.uid === null) {
            entry.fiber = undefined;
            const current = this.#catalog.snapshot(capabilityId);
            return this.#catalog.update(capabilityId, {
                phase: "STOPPED",
                error: current.desired_enabled ? current.error : null,
            });
        }

        this.#catalog.update(capabilityId, { phase: "STOPPING" });
        try {
            await fiber.dispose();
            if (entry.cleanupFailure !== undefined) throw entry.cleanupFailure;
            if (fiber.uid !== null) {
                throw new Error("Cordis Fiber retains uid after disposal");
            }
            entry.fiber = undefined;
            return this.#catalog.update(capabilityId, {
                phase: "STOPPED",
                error: null,
            });
        } catch (error) {
            entry.fiber = undefined;
            this.#catalog.update(capabilityId, {
                phase: "FAILED",
                apply_mode: "RESTART_REQUIRED",
                error: asError(
                    "CAPABILITY_CLEANUP_FAILED",
                    "cleanup",
                    error,
                    this.#now,
                    "重启工作台后再处理该能力",
                ),
            });
            throw error;
        }
    }

    #instrumentCleanup(plugin: Plugin, entry: RuntimeEntry): Plugin.Object {
        if (plugin === null || typeof plugin !== "object" || !("apply" in plugin)
            || typeof plugin.apply !== "function") {
            throw new TypeError("Provider module must export an object plugin with apply()");
        }
        const provider = plugin as Plugin.Object;
        return Object.freeze({
            ...provider,
            apply: async (context: Context, config: unknown) => {
                const result = await provider.apply.call(provider, context, config);
                if (typeof result !== "function") return result;
                return async () => {
                    try {
                        await result();
                    } catch (error) {
                        entry.cleanupFailure = error;
                        throw error;
                    }
                };
            },
        });
    }
}
