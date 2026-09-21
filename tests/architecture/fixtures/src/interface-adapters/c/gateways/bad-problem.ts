// Violation (problem-translation-only-in-http): a gateway translating errors to HTTP.
import { toProblem } from "../../http/to-problem.js";

export const badProblem = (): number => toProblem("x").status;
