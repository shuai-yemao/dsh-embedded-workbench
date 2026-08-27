import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function readJson(path) {
    return JSON.parse(await readFile(new URL(path, rootUrl), "utf8"));
}

test("M2 keeps one bundle and four internal workspace packages", async () => {
    const root = await readJson("package.json");

    assert.equal(root.name, "@dsh-embedded/dsh-embedded-workbench");
    assert.deepEqual(root.workspaces, [
        "packages/workbench-contracts",
        "packages/workbench-core",
        "packages/workbench-ui",
        "packages/provider-reference",
    ]);

    assert.equal(root.dependencies["@dsh-embedded/workbench-contracts"], "0.0.0");
    assert.equal(root.dependencies["@dsh-embedded/workbench-core"], "0.0.0");
    assert.equal(root.dependencies["@dsh-embedded/workbench-ui"], "0.0.0");
    assert.equal(root.optionalDependencies["@dsh-embedded/provider-reference"], "0.0.0");
    assert.equal(root.dependencies["@dsh-embedded/provider-reference"], undefined);
});

test("M2 pins internal, Cordis, and DeepSeek Harness versions", async () => {
    const packagePaths = [
        "package.json",
        "packages/workbench-contracts/package.json",
        "packages/workbench-core/package.json",
        "packages/workbench-ui/package.json",
        "packages/provider-reference/package.json",
    ];
    const manifests = await Promise.all(packagePaths.map(readJson));

    for (const manifest of manifests) {
        assert.equal(manifest.version, "0.0.0", `${manifest.name} version`);
        for (const section of ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"]) {
            for (const [name, version] of Object.entries(manifest[section] ?? {})) {
                if (name.startsWith("@dsh-embedded/")) {
                    assert.equal(version, "0.0.0", `${manifest.name} ${section} ${name}`);
                }
                if (name.startsWith("@deepseek-ai/dsh-")) {
                    assert.equal(version, "0.1.1-rc.2", `${manifest.name} ${section} ${name}`);
                }
                if (name === "@deepseek-ai/cordis") {
                    assert.equal(version, "4.0.1", `${manifest.name} ${section} ${name}`);
                }
            }
        }
    }
});

test("workspace dependency direction keeps providers and UI isolated", async () => {
    const contracts = await readJson("packages/workbench-contracts/package.json");
    const core = await readJson("packages/workbench-core/package.json");
    const ui = await readJson("packages/workbench-ui/package.json");
    const provider = await readJson("packages/provider-reference/package.json");

    assert.deepEqual(contracts.dependencies ?? {}, {});
    assert.equal(core.dependencies["@dsh-embedded/workbench-contracts"], "0.0.0");
    assert.equal(ui.dependencies["@dsh-embedded/workbench-contracts"], "0.0.0");
    assert.equal(provider.dependencies["@dsh-embedded/workbench-contracts"], "0.0.0");
    assert.equal(core.dependencies[provider.name], undefined);
    assert.equal(ui.dependencies[provider.name], undefined);
    assert.equal(provider.dependencies[core.name], undefined);
    assert.equal(provider.dependencies[ui.name], undefined);
});
