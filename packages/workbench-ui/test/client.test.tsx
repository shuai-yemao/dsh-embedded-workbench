import assert from "node:assert/strict";
import test from "node:test";

import type { WorkbenchUiController, WorkbenchUiState } from "../src/controller.js";
import { WorkbenchSettingsSectionView, inject } from "../src/client.js";

function walk(node: unknown, visit: (node: { type: unknown; props: Record<string, unknown> }) => void): void {
	if (Array.isArray(node)) {
		for (const child of node) walk(child, visit);
		return;
	}
	if (typeof node === "string") {
		visit({ type: "#text", props: { children: node } });
		return;
	}
	if (node === null || typeof node !== "object") return;
	const element = node as { type?: unknown; props?: Record<string, unknown> };
	if (element.props !== undefined) {
		visit({ type: element.type, props: element.props });
		if (typeof element.type === "function") {
			walk((element.type as (props: Record<string, unknown>) => unknown)(element.props), visit);
			return;
		}
		walk(element.props.children, visit);
		return;
	}
}

function state(overrides: Partial<WorkbenchUiState> = {}): WorkbenchUiState {
	return {
		loading: false,
		error: null,
		writable: true,
		snapshot: {
			health: "DEGRADED",
			capabilities: [{
				capability_id: "reference.lifecycle",
				display_name: "Reference Lifecycle",
				provider_version: null,
				contract_version: null,
				required: false,
				desired_enabled: true,
				availability: "MISSING",
				phase: "STOPPED",
				apply_mode: "RESTART_REQUIRED",
				error: {
					code: "CAPABILITY_MISSING",
					stage: "discover",
					message: "Reference Provider is unavailable",
					recoverable: true,
					suggested_action: "Install the provider",
					occurred_at: "2026-08-28T00:00:00.000Z",
					expected_version: "0.0.0",
					actual_version: "missing"
				},
				revision: 1,
				updated_at: "2026-08-28T00:00:00.000Z"
			}]
		},
		...overrides
	};
}

test("Settings view exposes all capability state, persistent unavailable details, and restart guidance", () => {
	const calls: string[] = [];
	const controller = {
		setEnabled: async (id: string, enabled: boolean) => { calls.push(`set:${id}:${enabled}`); },
		retry: async (id: string) => { calls.push(`retry:${id}`); },
		reset: async (confirmed: boolean) => { calls.push(`reset:${confirmed}`); }
	} as Pick<WorkbenchUiController, "setEnabled" | "retry" | "reset">;
	const tree = WorkbenchSettingsSectionView({ controller, state: state(), writable: false, confirmReset: () => true });
	const text: string[] = [];
	const inputs: Array<Record<string, unknown>> = [];
	const buttons: Array<Record<string, unknown>> = [];
	walk(tree, ({ type, props }) => {
		if (typeof props.children === "string") text.push(props.children);
		if (type === "input") inputs.push(props);
		if (type === "button") buttons.push(props);
	});

	assert.deepEqual(inject, ["slots", "settingsScope", "remote"]);
	assert.ok(text.includes("能力不可用"));
	assert.ok(text.includes("需要重启"));
	assert.ok(text.includes("CAPABILITY_MISSING"));
	assert.ok(text.includes("Install the provider"));
	assert.equal(inputs.length, 1);
	assert.equal(inputs[0].disabled, true);
	assert.equal(buttons.some(button => button.children === "重试"), false);
	const reset = buttons.find(button => button.children === "恢复默认设置");
	assert.equal(typeof reset?.onClick, "function");
	(reset?.onClick as () => void)();
	assert.deepEqual(calls, ["reset:true"]);
});
