// Shared access to the TypeScript program behind a type-aware rule (typescript-eslint parser
// services). A rule that finds no program is a no-op: it never fails a JS file by accident.
import ts from "typescript";

/** @import { Rule } from "eslint" */

/** @typedef {{ checker: ts.TypeChecker; toTs: (node: object) => ts.Node }} Typed */

/**
 * @param {Rule.RuleContext} context
 * @returns {Typed | undefined}
 */
export function typedServices(context) {
  const services =
    /** @type {{ program?: ts.Program; esTreeNodeToTSNodeMap?: { get(node: object): ts.Node } }} */ (
      context.sourceCode.parserServices
    );
  if (!services.program || !services.esTreeNodeToTSNodeMap) return undefined;
  const map = services.esTreeNodeToTSNodeMap;
  return { checker: services.program.getTypeChecker(), toTs: (node) => map.get(node) };
}

/**
 * Whether `type` is, or derives from, a class whose symbol is named `name` (walks the base types).
 * @param {ts.TypeChecker} checker
 * @param {ts.Type} type
 * @param {string} name
 * @returns {boolean}
 */
export function derivesFrom(checker, type, name) {
  if (type.isUnion()) return type.types.some((t) => derivesFrom(checker, t, name));
  if (type.symbol?.name === name) return true;
  if (!type.isClassOrInterface()) return false;
  return checker.getBaseTypes(type).some((base) => derivesFrom(checker, base, name));
}

/**
 * The declared name of a type symbol as the kind the rules reason about.
 * @param {ts.Type} type
 * @returns {"interface" | "class" | "other"}
 */
export function kindOf(type) {
  const flags = type.symbol?.flags ?? 0;
  if (flags & ts.SymbolFlags.Interface) return "interface";
  if (flags & ts.SymbolFlags.Class) return "class";
  return "other";
}

/**
 * @param {ts.Type} type
 * @returns {string | undefined} the value of a string literal type
 */
export function literalOf(type) {
  return type.isStringLiteral() ? type.value : undefined;
}
