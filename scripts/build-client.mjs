import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const projectRoot = resolve(import.meta.dirname, "..");

async function buildModuleLoaderClient({ entryPoint, outputPath, packageId, external = [] }) {
	const result = await build({
		entryPoints: [entryPoint],
		bundle: true,
		format: "cjs",
		platform: "browser",
		target: "es2022",
		write: false,
		minify: false,
		external,
		banner: {
			js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(packageId)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`
		},
		footer: { js: "return module.exports; } });" },
	});
	if (result.outputFiles.length !== 1) {
		throw new Error(`Expected one Client artifact for ${packageId}, received ${result.outputFiles.length}`);
	}
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, result.outputFiles[0].text, "utf8");
}

await buildModuleLoaderClient({
	entryPoint: resolve(projectRoot, "src", "client-entry.js"),
	outputPath: resolve(projectRoot, "lib", "client.js"),
	packageId: "@dsh-embedded/dsh-embedded-workbench",
	external: ["react", "react/jsx-runtime"],
});

await buildModuleLoaderClient({
	entryPoint: resolve(projectRoot, "packages", "workbench-ui", "src", "client.tsx"),
	outputPath: resolve(projectRoot, "packages", "workbench-ui", "lib", "client.js"),
	packageId: "@dsh-embedded/workbench-ui",
	external: ["react", "react/jsx-runtime"],
});
