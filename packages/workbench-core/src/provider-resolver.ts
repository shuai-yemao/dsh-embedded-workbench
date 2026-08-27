import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import type { Plugin } from "@deepseek-ai/cordis";

import {
    assertProviderManifest,
    freezeJsonSnapshot,
    isContractCompatible,
    isProviderVersionExact,
    type CapabilityAvailability,
    type CapabilityErrorSnapshot,
    type ProviderDescriptor,
    type ProviderManifest,
} from "@dsh-embedded/workbench-contracts";

export interface ProviderPackageManifest {
    readonly name: unknown;
    readonly version: unknown;
    readonly dshEmbedded?: { readonly provider?: unknown };
    readonly entry_url: string;
}

export interface ProviderModule {
    readonly manifest: ProviderManifest;
    readonly plugin: Plugin;
}

export interface ProviderResolution {
    readonly availability: CapabilityAvailability;
    readonly manifest: Readonly<ProviderManifest> | null;
    readonly module: ProviderModule | null;
    readonly error: Readonly<CapabilityErrorSnapshot> | null;
}

export interface ProviderResolverDependencies {
    readonly resolveManifest: (descriptor: ProviderDescriptor) => Promise<ProviderPackageManifest | undefined>;
    readonly importModule: (manifest: ProviderPackageManifest) => Promise<unknown>;
    readonly now?: () => Date;
}

export interface NodeProviderResolver {
    resolve(descriptor: ProviderDescriptor): Promise<ProviderResolution>;
}

function errorSnapshot(
    code: string,
    stage: CapabilityErrorSnapshot["stage"],
    message: string,
    now: () => Date,
    expectedVersion?: string,
    actualVersion?: string,
): Readonly<CapabilityErrorSnapshot> {
    return freezeJsonSnapshot({
        code,
        stage,
        message,
        recoverable: true,
        suggested_action: "检查能力包、版本或配置后手动重试",
        occurred_at: now().toISOString(),
        ...(expectedVersion === undefined ? {} : { expected_version: expectedVersion }),
        ...(actualVersion === undefined ? {} : { actual_version: actualVersion }),
    }) as Readonly<CapabilityErrorSnapshot>;
}

function unavailable(
    availability: Exclude<CapabilityAvailability, "AVAILABLE">,
    code: string,
    stage: CapabilityErrorSnapshot["stage"],
    message: string,
    now: () => Date,
    expectedVersion?: string,
    actualVersion?: string,
): ProviderResolution {
    return Object.freeze({
        availability,
        manifest: null,
        module: null,
        error: errorSnapshot(code, stage, message, now, expectedVersion, actualVersion),
    });
}

function isSameManifest(left: ProviderManifest, right: ProviderManifest): boolean {
    return left.capability_id === right.capability_id
        && left.display_name === right.display_name
        && left.provider_version === right.provider_version
        && left.contract_version === right.contract_version
        && left.apply_mode === right.apply_mode;
}

function asProviderModule(value: unknown): ProviderModule | undefined {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const module = value as Record<string, unknown>;
    if (!("manifest" in module)) return undefined;
    try {
        const plugin = module.default ?? (module.apply === undefined
            ? undefined
            : Object.freeze({
                ...(module.inject === undefined ? {} : { inject: module.inject }),
                apply: module.apply,
            }));
        if (plugin === undefined) return undefined;
        return {
            manifest: assertProviderManifest(module.manifest),
            plugin: plugin as Plugin,
        };
    } catch {
        return undefined;
    }
}

export async function resolveProvider(
    descriptor: ProviderDescriptor,
    dependencies: ProviderResolverDependencies,
): Promise<ProviderResolution> {
    const now = dependencies.now ?? (() => new Date());
    let packageManifest: ProviderPackageManifest | undefined;
    try {
        packageManifest = await dependencies.resolveManifest(descriptor);
    } catch (error) {
        return unavailable(
            "BLOCKED",
            "CAPABILITY_MANIFEST_INVALID",
            "discover",
            `无法读取 ${descriptor.package_name} manifest：${String(error)}`,
            now,
        );
    }
    if (packageManifest === undefined) {
        return unavailable(
            "MISSING",
            "CAPABILITY_MISSING",
            "discover",
            `未安装 Optional Provider：${descriptor.package_name}`,
            now,
        );
    }
    if (packageManifest.name !== descriptor.package_name || typeof packageManifest.version !== "string") {
        return unavailable(
            "BLOCKED",
            "CAPABILITY_MANIFEST_INVALID",
            "discover",
            `Provider manifest 与描述符不一致：${descriptor.package_name}`,
            now,
        );
    }

    let manifest: Readonly<ProviderManifest>;
    try {
        manifest = assertProviderManifest(packageManifest.dshEmbedded?.provider);
    } catch (error) {
        return unavailable(
            "BLOCKED",
            "CAPABILITY_MANIFEST_INVALID",
            "discover",
            `Provider manifest 非法：${String(error)}`,
            now,
        );
    }
    if (manifest.capability_id !== descriptor.capability_id || manifest.display_name !== descriptor.display_name) {
        return unavailable(
            "INCOMPATIBLE",
            "CAPABILITY_MANIFEST_INVALID",
            "compatibility",
            `Provider capability identity 与描述符不匹配：${descriptor.capability_id}`,
            now,
        );
    }
    try {
        if (!isProviderVersionExact(packageManifest.version, descriptor.expected_provider_version)
            || !isProviderVersionExact(manifest.provider_version, descriptor.expected_provider_version)) {
            return unavailable(
                "INCOMPATIBLE",
                "CAPABILITY_PROVIDER_VERSION_MISMATCH",
                "compatibility",
                `Provider 版本不匹配：${descriptor.package_name}`,
                now,
                descriptor.expected_provider_version,
                packageManifest.version,
            );
        }
        if (!isContractCompatible(manifest.contract_version, descriptor.supported_contract_major)) {
            return unavailable(
                "INCOMPATIBLE",
                "CAPABILITY_CONTRACT_INCOMPATIBLE",
                "compatibility",
                `Provider Contract 不兼容：${descriptor.package_name}`,
                now,
                String(descriptor.supported_contract_major),
                manifest.contract_version,
            );
        }
    } catch (error) {
        return unavailable(
            "BLOCKED",
            "CAPABILITY_MANIFEST_INVALID",
            "compatibility",
            `Provider 版本字段非法：${String(error)}`,
            now,
        );
    }

    let imported: unknown;
    try {
        imported = await dependencies.importModule(packageManifest);
    } catch (error) {
        return unavailable(
            "BLOCKED",
            "CAPABILITY_IMPORT_FAILED",
            "import",
            `Provider import 失败：${String(error)}`,
            now,
        );
    }
    const providerModule = asProviderModule(imported);
    if (providerModule === undefined || !isSameManifest(manifest, providerModule.manifest)) {
        return unavailable(
            "BLOCKED",
            "CAPABILITY_MANIFEST_DRIFT",
            "import",
            `Provider 代码 manifest 与静态 manifest 不一致：${descriptor.package_name}`,
            now,
        );
    }
    return Object.freeze({
        availability: "AVAILABLE" as const,
        manifest,
        module: providerModule,
        error: null,
    });
}

export function createNodeProviderResolver(packageBaseUrl: string, now?: () => Date): NodeProviderResolver {
    const requireFromBundle = createRequire(packageBaseUrl);
    return Object.freeze({
        async resolve(descriptor: ProviderDescriptor): Promise<ProviderResolution> {
            return resolveProvider(descriptor, {
                resolveManifest: async () => {
                    let packageJsonPath: string;
                    try {
                        packageJsonPath = requireFromBundle.resolve(`${descriptor.package_name}/package.json`);
                    } catch (error) {
                        if ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") return undefined;
                        throw error;
                    }
                    const entryPath = requireFromBundle.resolve(descriptor.package_name);
                    const raw = JSON.parse(await readFile(packageJsonPath, "utf8")) as Omit<ProviderPackageManifest, "entry_url">;
                    return { ...raw, entry_url: pathToFileURL(entryPath).href };
                },
                importModule: async (manifest) => import(manifest.entry_url),
                now,
            });
        },
    });
}
