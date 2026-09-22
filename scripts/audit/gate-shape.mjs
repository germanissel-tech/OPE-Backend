// Gate adapter `shape` (findings-v1, ADR-032): the shape of the rings (scripts/shape-rules.mjs)
// on the source root of the scope, findings narrowed to the files. A partial tree (an eval
// fixture) cannot hold every controller of the contract: that rule is for src/ only.
// `--list-rules`: the shape rules.
import path from "node:path";
import { repoRoot } from "../lib.mjs";
import { shapeFindings, SHAPE_RULES } from "../shape-rules.mjs";
import { emitFindings, emitRules, invocation, sourceRootOf } from "./lib.mjs";

const call = invocation(process.argv.slice(2));
if (call.listRules) {
  emitRules(SHAPE_RULES);
} else {
  const root = sourceRootOf(call.files);
  const bundle = path.join(repoRoot, "contracts", "dist", "openapi.yaml");
  const all = shapeFindings(path.join(repoRoot, root), bundle)
    .map((f) => ({ ...f, file: `${root}/${f.file}` }))
    .filter((f) => root === "src" || f.rule !== "shape/one-controller-per-operation");
  const scope = new Set(call.files);
  emitFindings(all.filter((f) => scope.size === 0 || scope.has(f.file) || f.file.includes("<module>")));
}
