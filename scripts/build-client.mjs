import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const projectRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(projectRoot, "lib", "client.js");
const packageId = "@dsh-embedded/dsh-embedded-workbench";

const result = await build({
	entryPoints: [resolve(projectRoot, "src", "client-entry.js")],
	bundle: true,
	format: "cjs",
	platform: "browser",
	target: "es2022",
	write: false,
	minify: false,
	banner: {
		js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(packageId)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`
	},
	footer: {
		js: "return module.exports; } });"
	}
});

if (result.outputFiles.length !== 1) {
	throw new Error(`Expected one Client artifact, received ${result.outputFiles.length}`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, result.outputFiles[0].text, "utf8");
