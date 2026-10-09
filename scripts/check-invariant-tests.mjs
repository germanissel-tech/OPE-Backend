// check:invariant-tests — every invariant declared in the contract has a server test whose
// title contains `[invariant:<slug>]` (FR-003; ADR-007), and an invariant that names a field
// (`pointer`, feature 040) has that test name the pointer the server publishes: `/body/<field>`.
//
//   node scripts/check-invariant-tests.mjs [--bundle <file>] [--tests-dir <dir>]
import { readFileSync } from "node:fs";
import path from "node:path";
import { argString, isRecord, parseArgs, readYaml, rel, report, walkFiles } from "./governance-lib.mjs";
import { bundlePath, repoRoot } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const bundle = path.resolve(argString(args, "bundle") ?? bundlePath);
const testsDir = path.resolve(argString(args, "tests-dir") ?? path.join(repoRoot, "tests"));

const doc = readYaml(bundle);

/** Collects { slug, at, pointer } from every x-invariants of the document. */
/** @type {{ slug: string; at: string; pointer?: string }[]} */
const declared = [];
/**
 * @param {unknown} node
 * @param {string} at
 */
function collect(node, at) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      collect(item, `${at}/${i}`);
    });
    return;
  }
  if (!isRecord(node)) return;
  const invariants = node["x-invariants"];
  if (Array.isArray(invariants)) {
    for (const inv of invariants) {
      if (!isRecord(inv) || typeof inv["type"] !== "string") continue;
      const pointer = inv["pointer"];
      declared.push(
        typeof pointer === "string" ? { slug: inv["type"], at, pointer } : { slug: inv["type"], at },
      );
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "x-invariants" || key === "example" || key === "examples") continue;
    collect(value, `${at}/${key}`);
  }
}
collect(doc, "#");

/** The content of every test file that marks a slug, by slug. */
/** @type {Map<string, string[]>} */
const tested = new Map();
// The governance test fixtures contain example markers: they do not count.
for (const file of walkFiles(testsDir, [".test.ts"], ["node_modules", ".git", "dist", "fixtures"])) {
  const content = readFileSync(file, "utf8");
  for (const m of content.matchAll(/\[invariant:([a-z0-9-]+)\]/g)) {
    if (m[1] !== undefined) tested.set(m[1], [...(tested.get(m[1]) ?? []), content]);
  }
}

/**
 * What a test of a pointed invariant has to contain: the pointer as the server publishes it, up to
 * its first segment (`origins[N]` → `/body/origins`), because which index is the test's to choose.
 * @param {string} pointer
 */
function publishedField(pointer) {
  const [segment = ""] = pointer.split(/[.[]/);
  return `/body/${segment}`;
}

const slugs = [...new Set(declared.map((d) => d.slug))];
const problems = slugs
  .filter((slug) => !tested.has(slug))
  .map((slug) => {
    const at = declared.find((d) => d.slug === slug)?.at ?? "?";
    return `missing a test with [invariant:${slug}] in ${rel(repoRoot, testsDir) || "tests"}/**/*.test.ts (invariant declared at ${at})`;
  });

// A pointed invariant is tested by a test that names the field; one of its tests is enough.
const pointed = declared.filter((d) => d.pointer !== undefined && tested.has(d.slug));
const unnamed = pointed.filter((d) => {
  const field = publishedField(d.pointer ?? "");
  return !(tested.get(d.slug) ?? []).some((content) => content.includes(field));
});
for (const d of unnamed) {
  problems.push(
    `the test of [invariant:${d.slug}] does not name the field it points at: expected \`${publishedField(d.pointer ?? "")}\` (pointer \`${d.pointer ?? ""}\` declared at ${d.at})`,
  );
}

const withTest = slugs.filter((slug) => tested.has(slug)).length;
const named = new Set(pointed.filter((d) => !unnamed.includes(d)).map((d) => d.slug)).size;
process.exit(
  report(
    problems,
    `Invariants: ${slugs.length} declared, ${withTest} with a test, ${named} naming the field`,
  ),
);
