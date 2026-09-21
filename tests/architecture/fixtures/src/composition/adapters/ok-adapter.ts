// An adapter between two modules of the ring lives in the composition (feature 018): no rule fires.
import { a } from "../../interface-adapters/a/index.js";
import { b } from "../../interface-adapters/b/index.js";
export const okAdapter = { a, b };
