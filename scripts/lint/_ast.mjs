// The slice of the typescript-estree AST the ope/* rules read, typed structurally: the estree
// typings ESLint ships know nothing of TypeScript nodes (`implements`, `abstract`, interfaces),
// so the rules cast once here and reason over these shapes.

/** @import { Rule } from "eslint" */

/**
 * @typedef {{ type: string; name?: string }} Identifier
 * @typedef {{ type: string; typeName?: Identifier }} TypeNode
 * @typedef {{ typeAnnotation?: { typeAnnotation?: TypeNode } }} Annotated
 * @typedef {{ type: string; key: Identifier; value?: { type: string; params: (Annotated & object)[] } }} ClassMember
 * @typedef {{ id?: Identifier | null; abstract?: boolean; implements?: { expression: Identifier }[]; body: { body: ClassMember[] } }} ClassNode
 * @typedef {{ type: string; key: Identifier; typeAnnotation?: { typeAnnotation: object } }} InterfaceMember
 * @typedef {{ id: Identifier; body: { body: InterfaceMember[] } }} InterfaceNode
 */

/**
 * Reads an ESLint node as one of the shapes above; the caller knows which one it visited.
 * @template T
 * @param {unknown} node
 * @returns {T}
 */
export function as(node) {
  return /** @type {T} */ (node);
}

/**
 * An ESLint node to report on, whatever its TypeScript type.
 * @param {unknown} node
 * @returns {Rule.Node}
 */
export function reportable(node) {
  return /** @type {Rule.Node} */ (node);
}

/**
 * @param {ClassNode} cls
 * @param {string} kind "MethodDefinition" | "PropertyDefinition"
 * @param {string} name
 * @returns {ClassMember | undefined}
 */
export function member(cls, kind, name) {
  return cls.body.body.find((m) => m.type === kind && m.key.type === "Identifier" && m.key.name === name);
}

/**
 * @param {ClassNode} cls
 * @returns {string}
 */
export function className(cls) {
  return cls.id?.name ?? "(anonymous)";
}
