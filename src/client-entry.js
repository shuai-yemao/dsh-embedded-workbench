import workbenchRemote from "@dsh-embedded/workbench-core/remote";
import { apply as applyWorkbenchUi, inject as workbenchUiInject } from "../packages/workbench-ui/src/client.tsx";

/**
 * DSH loads the root bundle's client entry as the browser module.  The UI
 * workspace is internal implementation detail rather than a separately
 * installed bundle, so its Settings contribution must be composed here.
 */
// Only `remote` may be statically injected: it is required to mount the
// generated Remote.  The mounted `remote.workbenchCapabilities` is injected
// dynamically afterwards, which avoids both a boot cycle and an undeclared
// Context property access.
export const inject = ["remote"];

export async function apply(context) {
	await context.remote.$mount(workbenchRemote);
	context.inject([...workbenchUiInject, "remote.workbenchCapabilities"], uiContext => {
		applyWorkbenchUi(uiContext);
	});
}
