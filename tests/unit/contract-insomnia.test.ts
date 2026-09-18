// The Insomnia collection is derived from the contract: one request per operation, with the
// credential header of its scheme and every instant of the example as a live template.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const bundle = path.resolve("contracts/dist/openapi.yaml");
const output = path.resolve("docs/api/insomnia.json");

interface Request {
  _type: string;
  method: string;
  url: string;
  headers: { name: string; value: string }[];
  body: { text?: string };
}

describe("contract:insomnia", () => {
  it.skipIf(!existsSync(bundle))(
    "covers every operation of the bundle with its credential header and live instants",
    () => {
      execFileSync(process.execPath, [path.resolve("scripts/contract-insomnia.mjs")], { stdio: "pipe" });
      const doc = parse(readFileSync(bundle, "utf8")) as { paths: Record<string, Record<string, unknown>> };
      const collection = JSON.parse(readFileSync(output, "utf8")) as { resources: Request[] };
      const requests = collection.resources.filter((r) => r._type === "request");
      const operations = Object.entries(doc.paths).flatMap(([route, item]) =>
        Object.keys(item).map((method) => `${method.toUpperCase()} {{ _.base_url }}${route}`),
      );
      expect(requests.map((r) => `${r.method} ${r.url}`).sort()).toEqual(operations.sort());
      const catalog = requests.find((r) => r.url.endsWith("/v1/catalog"));
      expect(catalog?.headers).toContainEqual({ name: "X-OPE-Platform-Key", value: "{{ _.platform_key }}" });
      expect(catalog?.body.text).toContain("{% now 'iso-8601', '' %}");
      expect(catalog?.body.text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
      const events = requests.find((r) => r.url.endsWith("/v1/events"));
      expect(events?.headers).toContainEqual({ name: "X-OPE-Ingest-Key", value: "{{ _.ingest_key }}" });
      expect(requests.find((r) => r.url.endsWith("/v1/health"))?.headers).toEqual([]);
    },
  );
});
