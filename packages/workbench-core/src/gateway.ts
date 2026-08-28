import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import {
    freezeCapabilitySnapshot,
    freezeWorkbenchSnapshot,
} from "@dsh-embedded/workbench-contracts";
import type {
    CapabilitySnapshot,
    WorkbenchSnapshot,
} from "@dsh-embedded/workbench-contracts/types";

/** The narrow Controller view that the Remote layer may invoke. */
export interface CapabilityGatewayController {
    snapshot(capabilityId: string): Readonly<CapabilitySnapshot>;
    snapshotAll(): Readonly<WorkbenchSnapshot>;
    retry(capabilityId: string): Promise<Readonly<CapabilitySnapshot>>;
    reconcile(capabilityId: string): Promise<Readonly<CapabilitySnapshot>>;
}

/** Read/control projection only; Provider and Settings implementation stay behind Core. */
export class WorkbenchCapabilitiesGateway extends TypertRemoteService {
    readonly #controller: CapabilityGatewayController;

    constructor(context: Context, controller: CapabilityGatewayController) {
        // The rc.2 Typert generator requires this binding argument to remain a literal.
        super(context, "workbenchCapabilities");
        this.#controller = controller;
    }

    @Remote("list")
    async list(): Promise<Readonly<WorkbenchSnapshot>> {
        return freezeWorkbenchSnapshot(this.#controller.snapshotAll());
    }

    @Remote("retry")
    async retry(capabilityId: string): Promise<Readonly<CapabilitySnapshot>> {
        this.#controller.snapshot(capabilityId);
        return freezeCapabilitySnapshot(await this.#controller.retry(capabilityId));
    }

    @Remote("reconcile")
    async reconcile(capabilityId: string): Promise<Readonly<CapabilitySnapshot>> {
        this.#controller.snapshot(capabilityId);
        return freezeCapabilitySnapshot(await this.#controller.reconcile(capabilityId));
    }
}
