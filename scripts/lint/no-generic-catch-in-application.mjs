// ope/no-generic-catch-in-application (ADR-023): ports never throw for business or availability
// reasons (they return a Result), so a `catch` in the application ring can only swallow a
// programming error and turn it into a silent wrong answer. Let it propagate to the adapter.

/** @import { Rule } from "eslint" */

/** @type {Rule.RuleModule} */
const noGenericCatchInApplication = {
  meta: {
    type: "problem",
    docs: { description: "No try/catch in the application ring: errors are values, exceptions propagate." },
    schema: [],
    messages: {
      caught:
        "No `catch` in the application ring: ports return a Result, and a programming error must propagate.",
    },
  },
  create(context) {
    return {
      CatchClause(node) {
        context.report({ node, messageId: "caught" });
      },
    };
  },
};

export default noGenericCatchInApplication;
