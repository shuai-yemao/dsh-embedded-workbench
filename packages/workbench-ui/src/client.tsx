import { useSyncExternalStore } from "react";

import { WORKBENCH_SETTINGS_NAMESPACE } from "@dsh-embedded/workbench-contracts";
import type { CapabilitySnapshot, WorkbenchSettings } from "@dsh-embedded/workbench-contracts";
import {
    WorkbenchUiController,
    type WorkbenchCapabilitiesRemote,
    type WorkbenchSettingsScope,
    type WorkbenchUiState,
} from "./controller.js";

export const inject = ["slots", "settingsScope", "remote", "remote.workbenchCapabilities"] as const;
const SECTION_ID = "dsh-embedded-workbench";
const SECTION_LABEL = "嵌入式开发工作台";

type ControllerActions = Pick<WorkbenchUiController, "setEnabled" | "retry" | "reset">;

export interface WorkbenchSettingsSectionProps {
    readonly controller: ControllerActions & Pick<WorkbenchUiController, "getSnapshot" | "subscribe">;
    readonly confirmReset?: () => boolean;
}

export interface WorkbenchSettingsSectionViewProps {
    readonly controller: ControllerActions;
    readonly state: WorkbenchUiState;
    readonly writable: boolean;
    readonly confirmReset: () => boolean;
}

function capabilityError(capability: CapabilitySnapshot) {
    if (capability.error === null) return null;
    return <aside role="alert">
        <strong>能力不可用</strong>
        <p>{capability.capability_id}: {capability.error.code}</p>
        <p>{capability.error.stage}: {capability.error.message}</p>
        {capability.error.expected_version !== undefined ? <p>期望版本：{capability.error.expected_version}</p> : null}
        {capability.error.actual_version !== undefined ? <p>实际版本：{capability.error.actual_version}</p> : null}
        <p>建议：{capability.error.suggested_action}</p>
    </aside>;
}

function CapabilityCard({ capability, controller, writable }: {
    readonly capability: CapabilitySnapshot;
    readonly controller: ControllerActions;
    readonly writable: boolean;
}) {
    const needsRestart = capability.apply_mode === "RESTART_REQUIRED";
    const canRetry = capability.error?.recoverable === true && capability.apply_mode === "LIVE";
    return <article aria-label={capability.display_name}>
        <h3>{capability.display_name}</h3>
        <dl>
            <div><dt>能力 ID</dt><dd>{capability.capability_id}</dd></div>
            <div><dt>可用性</dt><dd>{capability.availability}</dd></div>
            <div><dt>运行阶段</dt><dd>{capability.phase}</dd></div>
            <div><dt>应用方式</dt><dd>{capability.apply_mode}</dd></div>
        </dl>
        <label>
            <input
                type="checkbox"
                checked={capability.desired_enabled}
                disabled={!writable}
                aria-label={`启用 ${capability.display_name}`}
                onChange={event => { void controller.setEnabled(capability.capability_id, event.currentTarget.checked); }}
            />
            启用能力
        </label>
        {capability.availability !== "AVAILABLE" ? <p role="status">能力不可用</p> : null}
        {needsRestart ? <p role="status">需要重启</p> : null}
        {canRetry ? <button type="button" onClick={() => { void controller.retry(capability.capability_id); }}>重试</button> : null}
        {capabilityError(capability)}
    </article>;
}

export function WorkbenchSettingsSectionView({ controller, state, writable, confirmReset }: WorkbenchSettingsSectionViewProps) {
    return <section aria-labelledby={`${SECTION_ID}-title`}>
        <h2 id={`${SECTION_ID}-title`}>{SECTION_LABEL}</h2>
        {state.loading ? <p role="status">正在刷新能力状态</p> : null}
        {state.error !== null ? <aside role="alert"><strong>能力不可用</strong><p>{state.error.stage}: {state.error.message}</p></aside> : null}
        {state.snapshot === null ? <p>尚未获得能力状态。</p> : state.snapshot.capabilities.map(capability =>
            <CapabilityCard key={capability.capability_id} capability={capability} controller={controller} writable={writable} />
        )}
        <button type="button" onClick={() => { if (confirmReset()) void controller.reset(true); }}>恢复默认设置</button>
    </section>;
}

export function WorkbenchSettingsSection({ controller, confirmReset = () => globalThis.confirm("恢复嵌入式工作台的默认能力设置？") }: WorkbenchSettingsSectionProps) {
    const state = useSyncExternalStore(
        listener => controller.subscribe(listener),
        () => controller.getSnapshot(),
        () => controller.getSnapshot(),
    );
    return <WorkbenchSettingsSectionView
        controller={controller}
        state={state}
        writable={state.writable}
        confirmReset={confirmReset}
    />;
}

interface WorkbenchClientContext {
    readonly settingsScope: { bind<T>(spec: { readonly namespace: string }): WorkbenchSettingsScope };
    readonly remote: { readonly workbenchCapabilities: WorkbenchCapabilitiesRemote };
    on(event: "connection/reset", listener: () => void): () => void;
    effect(callback: () => (() => Promise<void>) | Promise<() => Promise<void>>, label: string): unknown;
    readonly slots: {
        inject(name: "settings.section", callback: () => unknown): unknown;
        register(options: Record<string, unknown>, component: typeof WorkbenchSettingsSection): unknown;
    };
}

/** rc.2 Client composition: bind the owned Settings scope and generated Remote, then register one section. */
export function apply(context: WorkbenchClientContext): void {
    const scope = context.settingsScope.bind<WorkbenchSettings>({ namespace: WORKBENCH_SETTINGS_NAMESPACE });
    const controller = new WorkbenchUiController({
        remote: { workbenchCapabilities: context.remote.workbenchCapabilities },
        scope,
        subscribeConnectionReset(listener) { return context.on("connection/reset", listener); },
    });
    context.effect(async () => {
        await controller.start();
        return async () => { await controller.dispose(); };
    }, "dsh-embedded-workbench: capability controller");
    context.slots.inject("settings.section", () => context.slots.register({
        name: "settings.section",
        id: SECTION_ID,
        order: 200,
        label: () => SECTION_LABEL,
        inject: () => ({ controller }),
    }, WorkbenchSettingsSection));
}
