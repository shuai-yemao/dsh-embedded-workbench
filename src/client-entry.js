import workbenchRemote from "@dsh-embedded/workbench-core/remote";
import { apply as applyWorkbenchUi, inject as workbenchUiInject } from "../packages/workbench-ui/src/client.tsx";

/**
 * DSH loads the root bundle's client entry as the browser module.  The UI
 * workspace is internal implementation detail rather than a separately
 * installed bundle, so its Settings contribution must be composed here.
 */
export const inject = workbenchUiInject;

export async function apply(context) {
	await context.remote.$mount(workbenchRemote);
	applyWorkbenchUi(context);
}
