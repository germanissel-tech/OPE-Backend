// ope/no-magic-strings (ADR-016): the string counterpart of no-magic-numbers, with the type
// checker deciding what "magic" means. A string literal written more than once in a file is
// magic when at least one occurrence lands somewhere the compiler does not check it against a
// literal type (a `string` parameter, a comparison against a plain `string`): a typo there
// compiles. The same literal repeated in typed positions (`problem("validation-failed")`,
// `process.once("SIGINT", …)`) is not magic: the literal union is the constant, and the compiler
// enforces it. Exempt: the declaration that names the constant, property keys, module specifiers
// and type positions.
import ts from "typescript";

/** @import { Rule } from "eslint" */
/** @typedef {Rule.Node} Node */
/** @typedef {Extract<Rule.Node, { type: "Literal" }>} Literal */

/** Positions where a literal is a name, a path or a type, never a value that could drift. */
const NAME_POSITIONS = new Set([
  "ImportDeclaration",
  "ImportExpression",
  "ExportAllDeclaration",
  "ExportNamedDeclaration",
  "TSLiteralType",
  "TSEnumMember",
]);

/**
 * Whether the type checks a literal: a string literal type, or a union with at least one.
 * @param {ts.Type} type
 * @returns {boolean}
 */
function checksLiteral(type) {
  if (type.isUnion()) return type.types.some(checksLiteral);
  return (type.flags & ts.TypeFlags.StringLiteral) !== 0 || (type.flags & ts.TypeFlags.TemplateLiteral) !== 0;
}

/** Nodes a declared value passes through on its way to the declarator: `const x = a ? "p" : "q"` declares both. */
const VALUE_WRAPPERS = new Set([
  "ArrayExpression",
  "ConditionalExpression",
  "LogicalExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
]);

/**
 * The literal that declares a named constant (`const X = "a"`, `const XS = ["a", "b"]`) is the
 * name itself; it is where repetition should point to, not a repetition.
 * @param {Node} node
 * @returns {boolean}
 */
function declaresConstant(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (VALUE_WRAPPERS.has(parent.type)) return declaresConstant(parent);
  return parent.type === "VariableDeclarator" && parent.init === node;
}

/** A literal with no letter or digit is punctuation (a separator, a root path), not a value that drifts. */
const HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * @param {Node} node
 * @returns {boolean}
 */
function isPropertyKey(node) {
  const parent = node.parent;
  return parent?.type === "Property" && parent.key === node;
}

/** @type {Rule.RuleModule} */
const noMagicStrings = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "A string literal repeated in a file must be named unless every occurrence is checked by a literal type.",
    },
    schema: [],
    messages: {
      repeated:
        'The string "{{value}}" is written {{count}} times in this file and here nothing checks it against a literal type: name it once (as `process.once` or `problem()` already check theirs).',
    },
  },
  create(context) {
    const services =
      /** @type {{ program?: ts.Program; esTreeNodeToTSNodeMap?: { get(node: object): ts.Node } }} */ (
        context.sourceCode.parserServices
      );
    if (!services.program || !services.esTreeNodeToTSNodeMap) return {};
    const checker = services.program.getTypeChecker();
    const map = services.esTreeNodeToTSNodeMap;
    /** @type {Map<string, { count: number; untyped: Literal[] }>} */
    const seen = new Map();

    /**
     * @param {Literal} node
     * @returns {boolean}
     */
    const checked = (node) => {
      const parent = node.parent;
      if (parent?.type === "MemberExpression" && parent.computed && parent.property === node) {
        // `record["key"]`: checked when the object's type declares the property; an index signature does not.
        const object = checker.getTypeAtLocation(map.get(parent.object));
        return typeof node.value === "string" && checker.getPropertyOfType(object, node.value) !== undefined;
      }
      if (parent && (parent.type === "BinaryExpression" || parent.type === "SwitchCase")) {
        const other =
          parent.type === "SwitchCase" ? parent.parent : parent.left === node ? parent.right : parent.left;
        const discriminant = other?.type === "SwitchStatement" ? other.discriminant : other;
        return discriminant !== undefined && checksLiteral(checker.getTypeAtLocation(map.get(discriminant)));
      }
      const contextual = checker.getContextualType(/** @type {ts.Expression} */ (map.get(node)));
      return contextual !== undefined && checksLiteral(contextual);
    };

    return {
      Literal(node) {
        if (typeof node.value !== "string" || !HAS_WORD_CHARACTER.test(node.value)) return;
        if (isPropertyKey(node) || declaresConstant(node)) return;
        if (NAME_POSITIONS.has(node.parent.type)) return;
        const entry = seen.get(node.value) ?? { count: 0, untyped: [] };
        entry.count += 1;
        if (!checked(node)) entry.untyped.push(node);
        seen.set(node.value, entry);
      },
      "Program:exit"() {
        for (const [value, { count, untyped }] of seen) {
          if (count < 2) continue;
          for (const node of untyped) {
            context.report({ node, messageId: "repeated", data: { value, count: String(count) } });
          }
        }
      },
    };
  },
};

export default { rules: { "no-magic-strings": noMagicStrings } };
