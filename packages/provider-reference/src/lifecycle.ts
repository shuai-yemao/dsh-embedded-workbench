import { randomUUID } from "node:crypto";

import { freezeJsonSnapshot } from "@dsh-embedded/workbench-contracts";

export type ReferenceFailureMode = "none" | "start" | "cleanup";
export type ReferenceLifecycleState =
    | "CREATED"
    | "STARTING"
    | "RUNNING"
    | "STOPPING"
    | "STOPPED"
    | "FAILED";

export interface ReferenceErrorSnapshot {
    readonly name: string;
    readonly message: string;
    readonly code: string;
}

export interface ReferenceLifecycleSnapshot {
    readonly instance_id: string;
    readonly state: ReferenceLifecycleState;
    readonly startup_error: ReferenceErrorSnapshot | null;
    readonly cleanup_errors: readonly ReferenceErrorSnapshot[];
    readonly cleanup_complete: boolean;
    readonly cleanup_timed_out: boolean;
    readonly remaining_resource_count: number;
}

export interface ReferenceDeadline {
    schedule(callback: () => void, milliseconds: number): { cancel(): void };
}

export type ReferenceDisposer = () => void | Promise<void>;
export type ReferenceResourceFactory = () => ReferenceDisposer | Promise<ReferenceDisposer>;

const REFERENCE_FAILURE_MODES = new Set<ReferenceFailureMode>(["none", "start", "cleanup"]);

export interface ReferenceLifecycleOptions {
    readonly failure?: ReferenceFailureMode;
    readonly cleanupTimeoutMs?: number;
    readonly deadline?: ReferenceDeadline;
    readonly resourceFactories?: readonly ReferenceResourceFactory[];
}

interface ResourceRecord {
    readonly dispose: ReferenceDisposer;
    active: boolean;
    attempted: boolean;
}

function lifecycleError(code: string, message: string): Error & { readonly code: string } {
    return Object.assign(new Error(message), { code });
}

function serializeError(error: unknown): ReferenceErrorSnapshot {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            code: typeof (error as Error & { code?: unknown }).code === "string"
                ? (error as Error & { code: string }).code
                : "UNSPECIFIED",
        };
    }
    return { name: "Error", message: String(error), code: "UNSPECIFIED" };
}

function defaultDeadline(callback: () => void, milliseconds: number): { cancel(): void } {
    const handle = setTimeout(callback, milliseconds);
    return { cancel: () => clearTimeout(handle) };
}

function defaultResourceFactories(): readonly ReferenceResourceFactory[] {
    return [
        async () => async () => undefined,
        async () => async () => undefined,
    ];
}

export function assertReferenceFailureMode(value: unknown): ReferenceFailureMode {
    if (!REFERENCE_FAILURE_MODES.has(value as ReferenceFailureMode)) {
        throw new TypeError(`Invalid reference failure mode: ${String(value)}`);
    }
    return value as ReferenceFailureMode;
}

function assertCleanupTimeoutMs(value: number | undefined): number {
    const timeoutMs = value ?? 1000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs !== 1000) {
        throw new TypeError("Reference cleanup timeout must be exactly 1000 ms");
    }
    return timeoutMs;
}

export function createReferenceLifecycle(options: ReferenceLifecycleOptions = {}) {
    const failure = assertReferenceFailureMode(options.failure ?? "none");
    const cleanupTimeoutMs = assertCleanupTimeoutMs(options.cleanupTimeoutMs);
    const deadline = options.deadline ?? { schedule: defaultDeadline };
    const resourceFactories = options.resourceFactories ?? defaultResourceFactories();
    const resources: ResourceRecord[] = [];
    const instanceId = `reference-${randomUUID()}`;

    let state: ReferenceLifecycleState = "CREATED";
    let startupError: ReferenceErrorSnapshot | null = null;
    let cleanupErrors: ReferenceErrorSnapshot[] = [];
    let cleanupComplete = false;
    let cleanupTimedOut = false;
    let cleanupFailureInjected = false;
    let stopRequested = false;
    let startPromise: Promise<ReferenceLifecycleSnapshot> | undefined;
    let disposePromise: Promise<ReferenceLifecycleSnapshot> | undefined;
    let cleanupPromise: Promise<ReferenceLifecycleSnapshot> | undefined;

    function snapshot(): ReferenceLifecycleSnapshot {
        return freezeJsonSnapshot({
            instance_id: instanceId,
            state,
            startup_error: startupError,
            cleanup_errors: cleanupErrors,
            cleanup_complete: cleanupComplete,
            cleanup_timed_out: cleanupTimedOut,
            remaining_resource_count: resources.filter((resource) => resource.active).length,
        });
    }

    async function drainResources(): Promise<void> {
        for (const resource of [...resources].reverse()) {
            if (!resource.active || resource.attempted) continue;
            resource.attempted = true;
            try {
                await resource.dispose();
                if (failure === "cleanup" && !cleanupFailureInjected) {
                    cleanupFailureInjected = true;
                    throw lifecycleError(
                        "REFERENCE_CLEANUP_INJECTED",
                        "Reference lifecycle cleanup failed by fixture request",
                    );
                }
                resource.active = false;
            } catch (error) {
                cleanupErrors.push(serializeError(error));
            }
        }
    }

    function runCleanup(startFailure: boolean): Promise<ReferenceLifecycleSnapshot> {
        if (cleanupPromise !== undefined) return cleanupPromise;
        state = "STOPPING";
        cleanupComplete = false;
        cleanupErrors = [];

        let signalTimeout!: () => void;
        const timeout = new Promise<void>((resolve) => { signalTimeout = resolve; });
        const onDeadline = () => {
            cleanupTimedOut = true;
            signalTimeout();
        };
        let deadlineHandle: { cancel(): void };
        try {
            deadlineHandle = deadline.schedule(onDeadline, cleanupTimeoutMs);
        } catch (error) {
            cleanupErrors.push(serializeError(error));
            deadlineHandle = defaultDeadline(onDeadline, cleanupTimeoutMs);
        }
        const drain = drainResources();
        drain.catch(() => undefined);

        cleanupPromise = (async () => {
            const completed = await Promise.race([
                drain.then(() => true),
                timeout.then(() => false),
            ]);
            if (!completed) {
                state = "FAILED";
                throw lifecycleError(
                    "REFERENCE_CLEANUP_TIMEOUT",
                    "Reference lifecycle cleanup exceeded deadline",
                );
            }

            deadlineHandle.cancel();
            cleanupComplete = resources.every((resource) => !resource.active);
            if (cleanupErrors.length > 0) {
                state = "FAILED";
                throw lifecycleError(
                    "REFERENCE_CLEANUP_FAILED",
                    "Reference lifecycle cleanup failed",
                );
            }
            state = startFailure ? "FAILED" : "STOPPED";
            return snapshot();
        })();
        return cleanupPromise;
    }

    async function runStart(): Promise<ReferenceLifecycleSnapshot> {
        state = "STARTING";
        try {
            for (const [index, acquire] of resourceFactories.entries()) {
                if (stopRequested) {
                    throw lifecycleError("REFERENCE_STOP_REQUESTED", "Reference lifecycle stop requested");
                }
                if (failure === "start" && index === 1) {
                    throw lifecycleError(
                        "REFERENCE_START_INJECTED",
                        "Reference lifecycle start failure requested by fixture",
                    );
                }
                const dispose = await acquire();
                if (typeof dispose !== "function") {
                    throw lifecycleError(
                        "REFERENCE_INVALID_DISPOSER",
                        "Reference resource factory must return a disposer",
                    );
                }
                resources.push({ dispose, active: true, attempted: false });
            }
            if (stopRequested) {
                throw lifecycleError("REFERENCE_STOP_REQUESTED", "Reference lifecycle stop requested");
            }
            state = "RUNNING";
            return snapshot();
        } catch (error) {
            startupError = serializeError(error);
            await runCleanup(true).catch(() => undefined);
            throw error;
        }
    }

    async function runDispose(): Promise<ReferenceLifecycleSnapshot> {
        if (startPromise !== undefined) await startPromise.catch(() => undefined);
        if (state === "STOPPED") return snapshot();
        if (cleanupPromise !== undefined) return cleanupPromise;
        return runCleanup(false);
    }

    function start(): Promise<ReferenceLifecycleSnapshot> {
        if (state === "STOPPED" || state === "FAILED") {
            return Promise.reject(lifecycleError(
                "REFERENCE_LIFECYCLE_TERMINAL",
                `Reference lifecycle is terminal: ${state}`,
            ));
        }
        if (startPromise === undefined) startPromise = runStart();
        return startPromise;
    }

    function dispose(): Promise<ReferenceLifecycleSnapshot> {
        stopRequested = true;
        if (disposePromise === undefined) disposePromise = runDispose();
        return disposePromise;
    }

    return Object.freeze({ start, dispose, snapshot });
}
