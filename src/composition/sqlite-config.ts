// Where the durable store lives (feature 030). It is a value of the **environment**, like the port
// or the host, not a value of behaviour: nothing decides differently because the file is in one
// place or another. So it does not enter the three levels of configuration of constitution XI and
// `check:behaviour-constants` is not watching for it — it arrives the way the composition reads
// everything else that describes the machine.
import path from "node:path";
import { text } from "./env.js";

const VARIABLE = "OPE_STORE";

/** Where a development run keeps its store when nothing says otherwise. */
const DEFAULT_FILE = "data/ope.db";

/** `:memory:` is SQLite's own name for a database that never touches disk; a test asks for it by name. */
const IN_MEMORY = ":memory:";

export interface StoreLocation {
  readonly file: string;
}

/**
 * `OPE_STORE` names the file; `data/ope.db` otherwise, so `npm run dev` survives its own restarts
 * without anyone configuring anything — which is the point of the feature for whoever is trying
 * something out locally.
 */
export function readStoreLocation(env: NodeJS.ProcessEnv): StoreLocation {
  const declared = text(env, VARIABLE) ?? DEFAULT_FILE;
  return { file: declared === IN_MEMORY ? IN_MEMORY : path.resolve(declared) };
}
