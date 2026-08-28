import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

function sha1(buffer) {
	return createHash("sha1").update(buffer).digest("hex");
}

/** A loopback-only, allowlisted registry used only by the M2 distribution test. */
export async function startLocalRegistry(packages) {
	const records = new Map();
	for (const item of packages) {
		const archive = await readFile(item.tarballPath);
		records.set(item.name, { ...item, archive, shasum: sha1(archive) });
	}
	const server = createServer((request, response) => {
		const path = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname).replace(/^\//, "");
		if (path.startsWith("tarballs/")) {
			const record = [...records.values()].find(item => item.tarballName === path.slice("tarballs/".length));
			if (record === undefined) { response.writeHead(404).end(); return; }
			response.writeHead(200, { "content-type": "application/octet-stream" });
			response.end(record.archive);
			return;
		}
		const record = records.get(path);
		if (record === undefined) { response.writeHead(404).end(); return; }
		const baseUrl = `http://127.0.0.1:${server.address().port}`;
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({
			name: record.name,
			"dist-tags": { latest: record.version },
			versions: {
				[record.version]: {
					name: record.name,
					version: record.version,
					dependencies: record.dependencies ?? {},
					optionalDependencies: record.optionalDependencies ?? {},
					dist: { tarball: `${baseUrl}/tarballs/${record.tarballName}`, shasum: record.shasum }
				}
			}
		}));
	});
	await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
	return Object.freeze({
		url: `http://127.0.0.1:${server.address().port}`,
		async close() { await new Promise(resolve => server.close(resolve)); }
	});
}
