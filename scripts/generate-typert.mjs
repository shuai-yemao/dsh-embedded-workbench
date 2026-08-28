import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { WorkspaceTypertGenerator } from "@deepseek-ai/dsh-typert-generator";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceCheckout = resolve(process.env.DSH_TYPERT_SOURCE_CHECKOUT ?? "D:/deepseek-harness-rc2");
const sourceCommit = "b150a551b8d465e31e418e1b2eaf5e79bbb7d28e";
const sourceTag = "dsh-v0.1.1-rc.2";
const execFile = promisify(execFileCallback);

async function readJson(path) {
    return JSON.parse(await readFile(path, "utf8"));
}

async function assertSourceCheckout() {
    const [{ stdout: commit }, { stdout: tag }, protocol, generator] = await Promise.all([
        execFile("git", ["-C", sourceCheckout, "rev-parse", "HEAD"]),
        execFile("git", ["-C", sourceCheckout, "describe", "--tags", "--exact-match", "HEAD"]),
        readJson(join(sourceCheckout, "packages/typert/protocol/package.json")),
        readJson(join(sourceCheckout, "packages/typert/generator/package.json")),
    ]);
    if (commit.trim() !== sourceCommit || tag.trim() !== sourceTag
        || protocol.version !== "0.1.1-rc.2" || generator.version !== "0.1.1-rc.2") {
        throw new Error("DSH_TYPERT_SOURCE_CHECKOUT is not the verified dsh-v0.1.1-rc.2 source checkout");
    }
}

async function createAnalysisOverlay() {
    const overlayRoot = await mkdtemp(join(tmpdir(), "dsh-ew-typert-"));
    const packagesRoot = join(overlayRoot, "packages");
    await Promise.all([
        cp(join(sourceCheckout, "packages/typert/protocol"), join(packagesRoot, "dsh-typert-protocol"), { recursive: true }),
        cp(join(projectRoot, "packages/workbench-contracts"), join(packagesRoot, "workbench-contracts"), { recursive: true }),
        cp(join(projectRoot, "packages/workbench-core"), join(packagesRoot, "workbench-core"), { recursive: true }),
        symlink(join(projectRoot, "node_modules"), join(overlayRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir"),
    ]);
    await Promise.all([
        writeFile(join(overlayRoot, "tsconfig.base.json"), JSON.stringify({
            compilerOptions: {
                target: "ES2022",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                lib: ["ES2022", "DOM"],
                types: ["node"],
                strict: true,
                ignoreDeprecations: "6.0",
                declaration: true,
                declarationMap: true,
                sourceMap: true,
                esModuleInterop: true,
                forceConsistentCasingInFileNames: true,
                skipLibCheck: true,
                jsx: "react-jsx",
                baseUrl: ".",
                paths: {
                    "@deepseek-ai/dsh-typert-protocol": ["packages/dsh-typert-protocol/src/index.ts"],
                    "@dsh-embedded/workbench-contracts": ["packages/workbench-contracts/src/index.ts"],
                    "@dsh-embedded/workbench-contracts/types": ["packages/workbench-contracts/src/types.ts"],
                    "@dsh-embedded/workbench-core": ["packages/workbench-core/src/index.ts"],
                },
            },
        }, null, 2)),
        writeFile(join(overlayRoot, "tsconfig.host.json"), JSON.stringify({
            extends: "./tsconfig.base.json",
            compilerOptions: { noEmit: true },
            files: [],
            references: [
                { path: "./packages/dsh-typert-protocol" },
                { path: "./packages/workbench-contracts" },
                { path: "./packages/workbench-core" },
            ],
        }, null, 2)),
        writeFile(join(overlayRoot, "packages/dsh-typert-protocol/tsconfig.json"), JSON.stringify({
            extends: "../../tsconfig.base.json",
            compilerOptions: { composite: true, rootDir: "src", outDir: "lib/types" },
            include: ["src/**/*.ts"],
        }, null, 2)),
    ]);
    return overlayRoot;
}

await assertSourceCheckout();
const overlayRoot = await createAnalysisOverlay();
let artifacts;
try {
    const generator = new WorkspaceTypertGenerator(overlayRoot);
    artifacts = generator.generate(["@dsh-embedded/workbench-core"], ["host"]);
} finally {
    await rm(overlayRoot, { recursive: true, force: true });
}

if (artifacts.length !== 1 || artifacts[0]?.face !== "host") {
    throw new Error(`Expected exactly one Host Typert artifact, received ${artifacts.length}`);
}

const artifact = artifacts[0];
if (artifact.remote === undefined) throw new Error("Workbench Core Remote artifact was not generated");
const methods = Array.from(artifact.remote.js.matchAll(/method:\s*["']([^"']+)["']/g), (match) => match[1]);
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
