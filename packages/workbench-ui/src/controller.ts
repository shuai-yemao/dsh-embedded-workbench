import type { WorkbenchSettings, WorkbenchSnapshot } from "@dsh-embedded/workbench-contracts";

const TRANSIENT_PHASES = new Set(["STARTING", "STOPPING"]);
const POLL_INTERVAL_MS = 500;
const POLL_LIMIT = 20;

export interface UiRemoteFailure {
    readonly message: string;
}

export type UiRemoteResult<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: UiRemoteFailure };

export interface WorkbenchCapabilitiesRemote {
    list(): Promise<UiRemoteResult<WorkbenchSnapshot>>;
    retry(capabilityId: string): Promise<UiRemoteResult<unknown>>;
    reconcile(capabilityId: string): Promise<UiRemoteResult<unknown>>;
}

export interface WorkbenchSettingsScope {
    getSnapshot(): { readonly value: WorkbenchSettings | undefined; readonly writable: boolean };
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}

export interface WorkbenchUiClock {
    schedule(callback: () => void, milliseconds: number): unknown;
    cancel(handle: unknown): void;
}

export interface WorkbenchUiControllerOptions {
    readonly remote: { readonly workbenchCapabilities: WorkbenchCapabilitiesRemote };
    readonly scope: WorkbenchSettingsScope;
    readonly subscribeConnectionReset: (listener: () => void) => () => void;
    readonly clock?: WorkbenchUiClock;
}

export interface WorkbenchUiError {
    readonly stage: "settings" | "remote";
    readonly message: string;
}

export interface WorkbenchUiState {
    readonly snapshot: WorkbenchSnapshot | null;
    readonly loading: boolean;
    readonly error: WorkbenchUiError | null;
}

function defaultClock(): WorkbenchUiClock {
    return {
        schedule(callback, milliseconds) { return setTimeout(callback, milliseconds); },
        cancel(handle) { clearTimeout(handle as ReturnType<typeof setTimeout>); },
    };
}

function state(snapshot: WorkbenchSnapshot | null, loading: boolean, error: WorkbenchUiError | null): WorkbenchUiState {
    return Object.freeze({ snapshot, loading, error });
}

/** Client-only synchronizer: one latest snapshot, bounded transient polling, and no UI-side history. */
export class WorkbenchUiController {
    readonly #remote: WorkbenchCapabilitiesRemote;
    readonly #scope: WorkbenchSettingsScope;
    readonly #subscribeConnectionReset: (listener: () => void) => () => void;
    readonly #clock: WorkbenchUiClock;
    readonly #listeners = new Set<() => void>();
    readonly #pending = new Set<Promise<void>>();
    #refreshTail: Promise<void> = Promise.resolve();
    #state: WorkbenchUiState = state(null, false, null);
    #timer: unknown;
    #pollCount = 0;
    #disposeScope: (() => void) | undefined;
    #disposeConnection: (() => void) | undefined;
    #started = false;
    #disposed = false;

    constructor(options: WorkbenchUiControllerOptions) {
        this.#remote = options.remote.workbenchCapabilities;
        this.#scope = options.scope;
        this.#subscribeConnectionReset = options.subscribeConnectionReset;
        this.#clock = options.clock ?? defaultClock();
    }

    getSnapshot(): WorkbenchUiState {
        return this.#state;
    }

    subscribe(listener: () => void): () => void {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    async start(): Promise<void> {
        if (this.#disposed) return;
        if (!this.#started) {
            this.#started = true;
            this.#disposeScope = this.#scope.subscribe(() => { void this.refresh(); });
            this.#disposeConnection = this.#subscribeConnectionReset(() => { void this.refresh(); });
        }
        await this.refresh();
    }

    refresh(): Promise<void> {
        if (this.#disposed) return Promise.resolve();
        const task = this.#refreshTail.then(() => this.#performRefresh());
        this.#refreshTail = task.catch(() => {});
        return this.#track(task);
    }

    async retry(capabilityId: string): Promise<void> {
        await this.#invoke("retry", capabilityId);
        await this.refresh();
    }

    async reconcile(capabilityId: string): Promise<void> {
        await this.#invoke("reconcile", capabilityId);
        await this.refresh();
    }

    async setEnabled(capabilityId: string, enabled: boolean): Promise<void> {
        const current = this.#scope.getSnapshot();
        if (!current.writable || current.value === undefined) {
            this.#setError("settings", "Settings are unavailable or read-only");
            return;
        }
        const capabilities = {
            ...current.value.capabilities,
            [capabilityId]: { enabled },
        };
        await this.#track(this.#scope.set("capabilities", capabilities));
        const settled = this.#scope.getSnapshot();
        if (settled.value?.capabilities[capabilityId]?.enabled !== enabled) {
            this.#setError("settings", "Host retained the latest Settings value; the requested change was not applied");
            return;
        }
        this.#replace(this.#state.snapshot, this.#state.loading, null);
        await this.reconcile(capabilityId);
    }

    async reset(confirmed: boolean): Promise<void> {
        if (!confirmed) return;
        await this.#track(this.#scope.unset("capabilities"));
        await this.refresh();
    }

    async dispose(): Promise<void> {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#clearTimer();
        this.#disposeScope?.();
        this.#disposeScope = undefined;
        this.#disposeConnection?.();
        this.#disposeConnection = undefined;
        await Promise.allSettled([...this.#pending]);
        this.#listeners.clear();
    }

    async #performRefresh(): Promise<void> {
        if (this.#disposed) return;
        this.#replace(this.#state.snapshot, true, this.#state.error);
        try {
            const result = await this.#remote.list();
            if (!result.ok) {
                this.#clearTimer();
                this.#setError("remote", result.error.message);
                return;
            }
            this.#replace(result.value, false, this.#state.error?.stage === "settings" ? this.#state.error : null);
            this.#updatePolling(result.value);
        } catch (error) {
            this.#clearTimer();
            this.#setError("remote", error instanceof Error ? error.message : String(error));
        }
    }

    async #invoke(method: "retry" | "reconcile", capabilityId: string): Promise<void> {
        try {
            const result = await this.#track(this.#remote[method](capabilityId));
            if (!result.ok) this.#setError("remote", result.error.message);
        } catch (error) {
            this.#setError("remote", error instanceof Error ? error.message : String(error));
        }
    }

    #updatePolling(snapshot: WorkbenchSnapshot): void {
        const transient = snapshot.capabilities.some(capability => TRANSIENT_PHASES.has(capability.phase));
        if (!transient) {
            this.#pollCount = 0;
            this.#clearTimer();
            return;
        }
        if (this.#timer !== undefined || this.#pollCount >= POLL_LIMIT || this.#disposed) return;
        this.#pollCount += 1;
        this.#timer = this.#clock.schedule(() => {
            this.#timer = undefined;
            void this.refresh();
        }, POLL_INTERVAL_MS);
    }

    #clearTimer(): void {
        if (this.#timer === undefined) return;
        this.#clock.cancel(this.#timer);
        this.#timer = undefined;
    }

    #setError(stage: WorkbenchUiError["stage"], message: string): void {
        this.#replace(this.#state.snapshot, false, Object.freeze({ stage, message }));
    }

    #replace(snapshot: WorkbenchSnapshot | null, loading: boolean, error: WorkbenchUiError | null): void {
        if (this.#disposed) return;
        this.#state = state(snapshot, loading, error);
        for (const listener of this.#listeners) listener();
    }

    #track<T>(promise: Promise<T>): Promise<T> {
        const tracked = promise.then(() => undefined);
        this.#pending.add(tracked);
        void tracked.finally(() => this.#pending.delete(tracked));
        return promise;
    }
}
