export const WORKBENCH_SETTINGS_NAMESPACE = "dsh-embedded-workbench" as const;
export const WORKBENCH_REMOTE_NAMESPACE = "workbenchCapabilities" as const;
export const WORKBENCH_CONTRACT_VERSION = "1.0.0" as const;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type DeepReadonly<T> = T extends JsonPrimitive
    ? T
    : T extends readonly (infer Item)[]
        ? readonly DeepReadonly<Item>[]
        : T extends object
            ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
            : never;

export type CapabilityAvailability = "AVAILABLE" | "MISSING" | "INCOMPATIBLE" | "BLOCKED";
export type CapabilityPhase = "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" | "FAILED";
export type CapabilityApplyMode = "LIVE" | "RESTART_REQUIRED";
export type WorkbenchHealth = "READY" | "DEGRADED" | "FAILED";
export type CapabilityErrorStage =
    | "discover"
    | "import"
    | "compatibility"
    | "start"
    | "stop"
    | "cleanup"
    | "settings"
    | "remote";

export interface CapabilityErrorSnapshot {
    readonly code: string;
    readonly stage: CapabilityErrorStage;
    readonly message: string;
    readonly recoverable: boolean;
    readonly suggested_action: string;
    readonly occurred_at: string;
    readonly expected_version?: string;
    readonly actual_version?: string;
}

export interface CapabilitySnapshot {
    readonly capability_id: string;
    readonly display_name: string;
    readonly provider_version: string | null;
    readonly contract_version: string | null;
    readonly required: boolean;
    readonly desired_enabled: boolean;
    readonly availability: CapabilityAvailability;
    readonly phase: CapabilityPhase;
    readonly apply_mode: CapabilityApplyMode;
    readonly error: CapabilityErrorSnapshot | null;
    readonly revision: number;
    readonly updated_at: string;
}

export interface WorkbenchSnapshot {
    readonly health: WorkbenchHealth;
    readonly capabilities: readonly CapabilitySnapshot[];
}

export interface ProviderDescriptor {
    readonly capability_id: string;
    readonly package_name: string;
    readonly display_name: string;
    readonly required: boolean;
    readonly expected_provider_version: string;
    readonly supported_contract_major: number;
    readonly default_enabled: boolean;
}

export interface ProviderManifest {
    readonly capability_id: string;
    readonly display_name: string;
    readonly provider_version: string;
    readonly contract_version: string;
    readonly apply_mode: "LIVE";
}

export interface WorkbenchSettings {
    readonly capabilities: Readonly<Record<string, { readonly enabled: boolean }>>;
}

const AVAILABILITY_VALUES = new Set<CapabilityAvailability>([
    "AVAILABLE",
    "MISSING",
    "INCOMPATIBLE",
    "BLOCKED",
]);
const PHASE_VALUES = new Set<CapabilityPhase>([
    "STOPPED",
    "STARTING",
    "RUNNING",
    "STOPPING",
    "FAILED",
]);
const APPLY_MODE_VALUES = new Set<CapabilityApplyMode>(["LIVE", "RESTART_REQUIRED"]);
const HEALTH_VALUES = new Set<WorkbenchHealth>(["READY", "DEGRADED", "FAILED"]);
const ERROR_STAGE_VALUES = new Set<CapabilityErrorStage>([
    "discover",
    "import",
    "compatibility",
    "start",
    "stop",
    "cleanup",
    "settings",
    "remote",
]);

const EXACT_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseExactVersion(version: string, label: string): readonly [number, number, number] {
    const match = EXACT_VERSION_PATTERN.exec(version);
    if (match === null) {
        throw new TypeError(`Invalid ${label}: ${version}`);
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isContractCompatible(version: string, supportedMajor: number): boolean {
    if (!Number.isSafeInteger(supportedMajor) || supportedMajor < 0) {
        throw new TypeError(`Invalid supported major: ${supportedMajor}`);
    }

    const [major] = parseExactVersion(version, "contract version");
    return major === supportedMajor;
}

export function isProviderVersionExact(actual: string, expected: string): boolean {
    parseExactVersion(actual, "provider version");
    parseExactVersion(expected, "expected provider version");
    return actual === expected;
}

function assertJsonSafe(value: unknown, active: WeakSet<object>, path: string): void {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return;
    }
    if (typeof value === "number") {
        if (Number.isFinite(value)) return;
        throw new TypeError(`Snapshot is not JSON-safe at ${path}: non-finite number`);
    }
    if (typeof value !== "object") {
        throw new TypeError(`Snapshot is not JSON-safe at ${path}: ${typeof value}`);
    }
    if (active.has(value)) {
        throw new TypeError(`Snapshot contains a cyclic reference at ${path}`);
    }

    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`Snapshot is not JSON-safe at ${path}: non-plain object`);
    }

    active.add(value);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key === "symbol") {
            throw new TypeError(`Snapshot is not JSON-safe at ${path}: symbol key`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined) {
            throw new TypeError(`Snapshot is not JSON-safe at ${path}.${key}: accessor`);
        }
        assertJsonSafe(descriptor.value, active, `${path}.${key}`);
    }
    active.delete(value);
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
    if (value !== null && typeof value === "object") {
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
        Object.freeze(value);
    }
    return value as DeepReadonly<T>;
}

export function freezeJsonSnapshot<T>(value: T): DeepReadonly<T> {
    assertJsonSafe(value, new WeakSet<object>(), "$");
    return deepFreeze(structuredClone(value));
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`${label} must be an object`);
    }
    return value as Record<string, unknown>;
}

function requireExactKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
    const allowedKeys = new Set(allowed);
    for (const key of Object.keys(record)) {
        if (!allowedKeys.has(key)) {
            throw new TypeError(`${label} has unexpected field: ${key}`);
        }
    }
    for (const key of allowed) {
        if (!(key in record) && key !== "expected_version" && key !== "actual_version") {
            throw new TypeError(`${label} is missing field: ${key}`);
        }
    }
}

function requireString(value: unknown, label: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError(`${label} must be a non-empty string`);
    }
}

function requireNullableExactVersion(value: unknown, label: string): void {
    if (value === null) return;
    requireString(value, label);
    parseExactVersion(value, label);
}

function validateCapabilityError(value: unknown): void {
    const error = requireRecord(value, "capability error");
    requireExactKeys(error, [
        "code",
        "stage",
        "message",
        "recoverable",
        "suggested_action",
        "occurred_at",
        "expected_version",
        "actual_version",
    ], "capability error");
    requireString(error.code, "capability error code");
    if (!ERROR_STAGE_VALUES.has(error.stage as CapabilityErrorStage)) {
        throw new TypeError(`Invalid capability error stage: ${String(error.stage)}`);
    }
    requireString(error.message, "capability error message");
    if (typeof error.recoverable !== "boolean") {
        throw new TypeError("capability error recoverable must be boolean");
    }
    requireString(error.suggested_action, "capability error suggested_action");
    requireString(error.occurred_at, "capability error occurred_at");
    if (error.expected_version !== undefined) requireString(error.expected_version, "expected_version");
    if (error.actual_version !== undefined) requireString(error.actual_version, "actual_version");
}

export function freezeCapabilitySnapshot(value: unknown): DeepReadonly<CapabilitySnapshot> {
    const snapshot = requireRecord(value, "capability snapshot");
    requireExactKeys(snapshot, [
        "capability_id",
        "display_name",
        "provider_version",
        "contract_version",
        "required",
        "desired_enabled",
        "availability",
        "phase",
        "apply_mode",
        "error",
        "revision",
        "updated_at",
    ], "capability snapshot");
    requireString(snapshot.capability_id, "capability_id");
    requireString(snapshot.display_name, "display_name");
    requireNullableExactVersion(snapshot.provider_version, "provider_version");
    requireNullableExactVersion(snapshot.contract_version, "contract_version");
    if (typeof snapshot.required !== "boolean" || typeof snapshot.desired_enabled !== "boolean") {
        throw new TypeError("capability required and desired_enabled must be boolean");
    }
    if (!AVAILABILITY_VALUES.has(snapshot.availability as CapabilityAvailability)) {
        throw new TypeError(`Invalid capability availability: ${String(snapshot.availability)}`);
    }
    if (!PHASE_VALUES.has(snapshot.phase as CapabilityPhase)) {
        throw new TypeError(`Invalid capability phase: ${String(snapshot.phase)}`);
    }
    if (!APPLY_MODE_VALUES.has(snapshot.apply_mode as CapabilityApplyMode)) {
        throw new TypeError(`Invalid capability apply_mode: ${String(snapshot.apply_mode)}`);
    }
    if (snapshot.error !== null) validateCapabilityError(snapshot.error);
    if (!Number.isSafeInteger(snapshot.revision) || (snapshot.revision as number) < 0) {
        throw new TypeError("capability revision must be a non-negative safe integer");
    }
    requireString(snapshot.updated_at, "updated_at");
    return freezeJsonSnapshot(snapshot) as unknown as DeepReadonly<CapabilitySnapshot>;
}

export function freezeWorkbenchSnapshot(value: unknown): DeepReadonly<WorkbenchSnapshot> {
    const snapshot = requireRecord(value, "workbench snapshot");
    requireExactKeys(snapshot, ["health", "capabilities"], "workbench snapshot");
    if (!HEALTH_VALUES.has(snapshot.health as WorkbenchHealth)) {
        throw new TypeError(`Invalid workbench health: ${String(snapshot.health)}`);
    }
    if (!Array.isArray(snapshot.capabilities)) {
        throw new TypeError("workbench capabilities must be an array");
    }
    const capabilityIds = new Set<string>();
    const capabilities = snapshot.capabilities.map((capability) => {
        const frozen = freezeCapabilitySnapshot(capability);
        if (capabilityIds.has(frozen.capability_id)) {
            throw new TypeError(`Duplicate capability_id: ${frozen.capability_id}`);
        }
        capabilityIds.add(frozen.capability_id);
        return frozen;
    });
    return freezeJsonSnapshot({
        health: snapshot.health as WorkbenchHealth,
        capabilities,
    });
}

export function assertProviderManifest(value: unknown): DeepReadonly<ProviderManifest> {
    const manifest = requireRecord(value, "provider manifest");
    requireExactKeys(manifest, [
        "capability_id",
        "display_name",
        "provider_version",
        "contract_version",
        "apply_mode",
    ], "provider manifest");
    requireString(manifest.capability_id, "provider manifest capability_id");
    requireString(manifest.display_name, "provider manifest display_name");
    requireString(manifest.provider_version, "provider manifest provider_version");
    requireString(manifest.contract_version, "provider manifest contract_version");
    parseExactVersion(manifest.provider_version, "provider version");
    parseExactVersion(manifest.contract_version, "contract version");
    if (manifest.apply_mode !== "LIVE") {
        throw new TypeError(`Invalid provider manifest apply_mode: ${String(manifest.apply_mode)}`);
    }
    return freezeJsonSnapshot(manifest) as unknown as DeepReadonly<ProviderManifest>;
}
