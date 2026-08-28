import workbenchRemote from "@dsh-embedded/workbench-core/remote";

export const inject = ["remote"];

export async function apply(context) {
	return context.remote.$mount(workbenchRemote);
}
