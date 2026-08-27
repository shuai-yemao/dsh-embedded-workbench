import {
    freezeCapabilitySnapshot,
    freezeWorkbenchSnapshot,
    type CapabilitySnapshot,
    type ProviderDescriptor,
    type WorkbenchHealth,
    type WorkbenchSnapshot,
} from "@dsh-embedded/workbench-contracts";

export type CapabilitySnapshotPatch = Partial<Omit<
    CapabilitySnapshot,
    "capability_id" | "display_name" | "required" | "revision" | "updated_at"
>>;

export type CatalogClock = () => Date;

function defaultClock(): Date {
    return new Date();
}

function initialSnapshot(descriptor: ProviderDescriptor, clock: CatalogClock): CapabilitySnapshot {
    return {
        capability_id: descriptor.capability_id,
        display_name: descriptor.display_name,
        provider_version: null,
        contract_version: null,
        required: descriptor.required,
        desired_enabled: descriptor.default_enabled,
        availability: "BLOCKED",
        phase: "STOPPED",
        apply_mode: "LIVE",
        error: null,
        revision: 0,
        updated_at: clock().toISOString(),
    };
}

export class CapabilityCatalog {
    readonly #snapshots = new Map<string, CapabilitySnapshot>();
    readonly #clock: CatalogClock;

    constructor(descriptors: readonly ProviderDescriptor[], clock: CatalogClock = defaultClock) {
        this.#clock = clock;
        for (const descriptor of descriptors) {
            if (this.#snapshots.has(descriptor.capability_id)) {
                throw new TypeError(`Duplicate capability_id: ${descriptor.capability_id}`);
            }
            this.#snapshots.set(
                descriptor.capability_id,
                freezeCapabilitySnapshot(initialSnapshot(descriptor, this.#clock)),
            );
        }
    }

    snapshot(capabilityId: string): Readonly<CapabilitySnapshot> {
        const snapshot = this.#snapshots.get(capabilityId);
        if (snapshot === undefined) throw new RangeError(`Unknown capability_id: ${capabilityId}`);
        return freezeCapabilitySnapshot(snapshot);
    }

    snapshotAll(): Readonly<WorkbenchSnapshot> {
        return freezeWorkbenchSnapshot({
            health: this.health(),
            capabilities: Array.from(this.#snapshots.values()),
        });
    }

    update(capabilityId: string, patch: CapabilitySnapshotPatch): Readonly<CapabilitySnapshot> {
        const current = this.#snapshots.get(capabilityId);
        if (current === undefined) throw new RangeError(`Unknown capability_id: ${capabilityId}`);
        const next = freezeCapabilitySnapshot({
            ...current,
            ...patch,
            capability_id: current.capability_id,
            display_name: current.display_name,
            required: current.required,
            revision: current.revision + 1,
            updated_at: this.#clock().toISOString(),
        });
        this.#snapshots.set(capabilityId, next);
        return next;
    }

    health(): WorkbenchHealth {
        for (const snapshot of this.#snapshots.values()) {
            if (!snapshot.desired_enabled) continue;
            if (snapshot.availability !== "AVAILABLE" || snapshot.phase !== "RUNNING") {
                return "DEGRADED";
            }
        }
        return "READY";
    }
}
