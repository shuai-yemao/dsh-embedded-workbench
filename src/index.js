import { createWorkbenchLifecycle } from "./workbench-lifecycle.js";

export const name = "dsh-embedded-workbench";

export async function apply() {
	console.log("[dsh-embedded-workbench] M0 loaded");
	const lifecycle = createWorkbenchLifecycle({
		emit: record => console.log(JSON.stringify({ lifecycle: record }))
	});
	await lifecycle.start();
	return () => lifecycle.dispose();
}
