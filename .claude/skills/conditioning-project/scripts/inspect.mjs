// inspect — what a repository already has for an audit, without writing anything.
//
//   node inspect.mjs <root>
//
// Prints JSON: sources of truth found (constitution, ADRs, agent guide, specs), quality tools
// found and whether each has a gate adapter, the adapters present, the proposed module roots,
// the source root, the git base of a diff, the existing profile if any, and the questions that
// remain for the owner (each with options and a suggestion). Nothing detected is asked.
import path from "node:path";
import { inspect } from "./inspection.mjs";

const root = path.resolve(process.argv[2] ?? ".");
console.log(JSON.stringify(inspect(root), null, 2));
