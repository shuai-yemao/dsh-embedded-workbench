export const name = "dsh-embedded-test-tool-snapshot";
export const inject = ["tools"];

export function apply(ctx) {
	const tools = ctx.tools.schemas().map((schema) => schema.name).sort();
	console.log(JSON.stringify({
		marker: "dsh-embedded-tool-snapshot",
		run: process.env.DSH_M0_RUN_ID ?? "unknown",
		phase: process.env.DSH_M0_TOOL_SNAPSHOT_PHASE ?? "unknown",
		tools
	}));
}
