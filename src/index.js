import core from "@dsh-embedded/workbench-core";
import { TYPERT } from "@dsh-embedded/workbench-core/typert";

import { PROVIDERS } from "./providers.js";

export const name = "dsh-embedded-workbench";
export const inject = ["typert"];

export async function apply(context) {
	const unregisterTypert = context.typert.register(TYPERT);
	let coreFiber;
	try {
		coreFiber = context.plugin(core, {
			descriptors: PROVIDERS,
			packageBaseUrl: import.meta.url
		});
		await coreFiber.await();
	} catch (error) {
		try {
			if (coreFiber) await coreFiber.dispose();
		} finally {
			await unregisterTypert();
		}
		throw error;
	}

	return async () => {
		try {
			await coreFiber.dispose();
		} finally {
			await unregisterTypert();
		}
	};
}
