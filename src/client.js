(() => {
	const PACKAGE_ID = "@dsh-embedded/dsh-embedded-workbench";
	const SECTION_ID = "dsh-embedded-workbench";
	const SECTION_LABEL = "嵌入式开发工作台";

	function makeFactory() {
		return (require) => {
			const { jsx } = require("react/jsx-runtime");

			function WorkbenchSection() {
				return jsx("section", {
					children: [
						jsx("h2", { children: SECTION_LABEL }),
						jsx("p", { children: "M0 插件已加载。更多嵌入式能力将在后续里程碑提供。" })
					]
				});
			}

			function apply(ctx) {
				ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: SECTION_ID,
					order: 200,
					label: () => SECTION_LABEL
				}, WorkbenchSection)), "dsh-embedded-workbench: settings section");
			}

			return {
				name: SECTION_ID,
				inject: ["slots"],
				apply
			};
		};
	}

	window.__ModuleLoader__.load({
		id: PACKAGE_ID,
		factory: makeFactory()
	});
})();
