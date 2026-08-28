import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { WorkspaceTypertGenerator } from "@deepseek-ai/dsh-typert-generator";

const projectRoot = resolve(import.meta.dirname, "..");
const generator = new WorkspaceTypertGenerator(projectRoot);
const artifacts = generator.generate(["@dsh-embedded/workbench-core"], ["host"]);

if (artifacts.length !== 1 || artifacts[0]?.face !== "host") {
    throw new Error(`Expected exactly one Host Typert artifact, received ${artifacts.length}`);
}

const artifact = artifacts[0];
if (artifact.remote === undefined) throw new Error("Workbench Core Remote artifact was not generated");
const methods = artifact.remote.js.match(/method: "([^"]+)"/g)?.map((match) => match.slice(9, -1)) ?? [];
if (methods.join(",") !== "list,reconcile,retry") {
    throw new Error(`Unexpected Workbench Core Remote methods: ${methods.join(",")}`);
}

const output = resolve(projectRoot, artifact.packageRoot, "lib");
await mkdir(output, { recursive: true });
await Promise.all([
    writeFile(resolve(output, "typert.host.js"), artifact.js),
    writeFile(resolve(output, "typert.host.d.ts"), artifact.dts),
    writeFile(resolve(output, "typert.remote-client.js"), artifact.remote.js),
    writeFile(resolve(output, "typert.remote-client.d.ts"), artifact.remote.dts),
    writeFile(resolve(output, "typert.remote-client.d.ts.map"), artifact.remote.dtsMap),
]);
