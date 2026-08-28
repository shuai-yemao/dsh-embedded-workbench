import assert from "node:assert/strict";
import test from "node:test";

import type Schema from "@deepseek-ai/schemastery";
import type { SettingsNamespace, SettingsScope } from "@deepseek-ai/dsh-settings";
import type { ProviderDescriptor, WorkbenchSettings } from "@dsh-embedded/workbench-contracts";

import {
    createWorkbenchSettingsOwner,
    type DesiredEnabledController,
    type WorkbenchSettingsRegistrar,
} from "../src/settings.ts";

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

class FakeScope<T> implements SettingsScope<T> {
    readonly #watchers = new Set<(next: T, previous: T) => void | Promise<void>>();
    readonly updates: object[] = [];
    readonly replacements: object[] = [];

    constructor(private value: T) {}

    get(): T {
        return this.value;
    }

    watch(callback: (next: T, previous: T) => void | Promise<void>): () => void {
        this.#watchers.add(callback);
        return () => this.#watchers.delete(callback);
    }

    async update(patch: object): Promise<void> {
        this.updates.push(patch);
    }

    async replace(section: object): Promise<void> {
        this.replacements.push(section);
    }

    async emit(next: T): Promise<void> {
        const previous = this.value;
        this.value = next;
        for (const watcher of this.#watchers) await watcher(next, previous);
    }
}

class FakeSettings implements WorkbenchSettingsRegistrar {
    namespace: SettingsNamespace | undefined;
    options: { readonly base?: Partial<WorkbenchSettings> } | undefined;
    readonly scope: FakeScope<WorkbenchSettings>;

    constructor(initial: WorkbenchSettings) {
        this.scope = new FakeScope(initial);
    }

    register<T>(
        namespace: SettingsNamespace,
        _schema: Schema<T>,
        options?: { readonly base?: Partial<T> },
    ): SettingsScope<T> {
        this.namespace = namespace;
        this.options = options as { readonly base?: Partial<WorkbenchSettings> } | undefined;
        return this.scope as unknown as SettingsScope<T>;
    }
}

function settings(alpha: boolean, beta: boolean): WorkbenchSettings {
    return { capabilities: { "fixture.alpha": { enabled: alpha }, "fixture.beta": { enabled: beta } } };
}

test("Settings owner registers the approved namespace and descriptor defaults without persisting", () => {
    const registrar = new FakeSettings(settings(true, false));
    const controller: DesiredEnabledController = {
        setDesiredEnabled: async () => undefined,
        reportSettingsError: () => undefined,
    };

    const owner = createWorkbenchSettingsOwner({ registrar, controller, descriptors });

    assert.equal(registrar.namespace, "dsh-embedded-workbench");
    assert.deepEqual(registrar.options?.base, settings(true, false));
    assert.deepEqual(owner.current(), settings(true, false));
    owner.dispose();
    assert.deepEqual(registrar.scope.updates, []);
    assert.deepEqual(registrar.scope.replacements, []);
});

test("Settings watcher reconciles only changed known IDs and contains one capability failure", async () => {
    const registrar = new FakeSettings(settings(true, false));
    const reconciled: Array<readonly [string, boolean]> = [];
    const errors: string[] = [];
    const controller: DesiredEnabledController = {
        async setDesiredEnabled(capabilityId, enabled) {
            reconciled.push([capabilityId, enabled]);
            if (capabilityId === "fixture.alpha") throw new Error("alpha setting rejected");
        },
        reportSettingsError(capabilityId) {
            errors.push(capabilityId);
        },
    };
    const owner = createWorkbenchSettingsOwner({ registrar, controller, descriptors });

    await registrar.scope.emit({
        capabilities: {
            "fixture.alpha": { enabled: false },
            "fixture.beta": { enabled: true },
            "fixture.retired": { enabled: true },
        },
    });

    assert.deepEqual(reconciled, [["fixture.alpha", false], ["fixture.beta", true]]);
    assert.deepEqual(errors, ["fixture.alpha"]);
    owner.dispose();
    await registrar.scope.emit(settings(true, false));
    assert.equal(reconciled.length, 2);
});

test("Settings owner applies the resolved initial desired state without writing the document", async () => {
    const registrar = new FakeSettings(settings(false, true));
    const reconciled: Array<readonly [string, boolean]> = [];
    const controller: DesiredEnabledController = {
        async setDesiredEnabled(capabilityId, enabled) {
            reconciled.push([capabilityId, enabled]);
        },
        reportSettingsError: () => undefined,
    };
    const owner = createWorkbenchSettingsOwner({ registrar, controller, descriptors });

    await owner.reconcileInitial();

    assert.deepEqual(reconciled, [["fixture.alpha", false], ["fixture.beta", true]]);
    assert.deepEqual(registrar.scope.updates, []);
    assert.deepEqual(registrar.scope.replacements, []);
    owner.dispose();
});
