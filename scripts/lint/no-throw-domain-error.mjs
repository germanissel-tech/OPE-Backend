// ope/no-throw-domain-error (ADR-023): a business error is a value a use case returns inside a
// Result, never something it throws. `throw` is for programming errors (a broken contract, an
// internal invariant), which the HTTP adapter turns into 500. Throwing a DomainError would
// bypass the typed response and the single translation.
import { derivesFrom, typedServices } from "./_typed.mjs";

/** @import { Rule } from "eslint" */

const ROOT = "DomainError";

/** @type {Rule.RuleModule} */
const noThrowDomainError = {
  meta: {
    type: "problem",
    docs: { description: "A DomainError is returned in a Result, never thrown." },
    schema: [],
    messages: {
      thrown: "A business error is returned with fail(), never thrown: `throw` is for programming errors.",
    },
  },
  create(context) {
    const typed = typedServices(context);
    if (!typed) return {};
    const { checker, toTs } = typed;
    return {
      ThrowStatement(node) {
        const type = checker.getTypeAtLocation(toTs(node.argument));
        if (derivesFrom(checker, type, ROOT)) context.report({ node, messageId: "thrown" });
      },
    };
  },
};

export default noThrowDomainError;
