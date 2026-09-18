// ope/domain-no-loose-functions (ADR-024): the domain exports types, classes and constant
// catalogues; a rule lives with the concept it protects, as a method or a factory, never as a
// loose exported function that a consumer has to remember to call. The primitives of the shared
// kernel (Result constructors, time helpers) and the identifier constructors of every module
// (`ids.ts`) are the declared exception.

/** @import { Rule } from "eslint" */

/** Path suffixes (posix) of the files allowed to export functions, by default. */
const DEFAULT_ALLOW = ["/ids.ts", "shared-kernel/result.ts", "shared-kernel/time.ts"];

/**
 * @param {string} filename
 * @param {readonly string[]} allow
 * @returns {boolean}
 */
function allowed(filename, allow) {
  const posix = filename.replaceAll("\\", "/");
  return allow.some((suffix) => posix.endsWith(suffix));
}

/**
 * @param {{ type: string } | null | undefined} init
 * @returns {boolean}
 */
function isFunction(init) {
  return init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression";
}

/** @type {Rule.RuleModule} */
const domainNoLooseFunctions = {
  meta: {
    type: "problem",
    docs: { description: "The domain exports no loose functions: a rule belongs to its concept." },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      loose:
        "The domain exports the function `{{name}}`: make it a method or a factory of the concept it protects (ADR-024).",
    },
  },
  create(context) {
    const options = /** @type {{ allow?: string[] } | undefined} */ (context.options[0]);
    if (allowed(context.filename, options?.allow ?? DEFAULT_ALLOW)) return {};
    return {
      ExportNamedDeclaration(node) {
        const declaration = node.declaration;
        if (!declaration) return;
        if (declaration.type === "FunctionDeclaration") {
          context.report({
            node: declaration,
            messageId: "loose",
            data: { name: declaration.id?.name ?? "(anonymous)" },
          });
          return;
        }
        if (declaration.type !== "VariableDeclaration") return;
        for (const declarator of declaration.declarations) {
          if (!isFunction(declarator.init)) continue;
          const name = declarator.id.type === "Identifier" ? declarator.id.name : "(destructured)";
          context.report({ node: declarator, messageId: "loose", data: { name } });
        }
      },
    };
  },
};

export default domainNoLooseFunctions;
