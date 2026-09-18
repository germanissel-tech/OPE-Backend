// ope/dependencies-are-interfaces (ADR-023): a *Dependencies interface in the application ring
// lists what a use case or service needs to operate: ports, services and cross-cutting
// utilities, every one of them an interface (never a class, a function or the ports container),
// and no more than `maxDependencies` of them. Past the limit the use case does too much: the
// answer is a service, not a bigger object.
import { as, reportable } from "./_ast.mjs";
import { kindOf, typedServices } from "./_typed.mjs";

/** @import { Rule } from "eslint" */
/** @import { InterfaceNode } from "./_ast.mjs" */

const DEPENDENCIES_SUFFIX = "Dependencies";
/** Six: beyond it the constructor reads like a container; extract a service (spec 008, FR-004). */
const DEFAULT_MAX_DEPENDENCIES = 6;

/**
 * @param {"interface" | "class" | "other"} kind
 * @returns {string}
 */
function describe(kind) {
  return kind === "class" ? "a class" : "not a named interface";
}

/** @type {Rule.RuleModule} */
const dependenciesAreInterfaces = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Every field of a *Dependencies interface is an interface; at most maxDependencies of them.",
    },
    schema: [
      {
        type: "object",
        properties: { maxDependencies: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooMany: "{{name}} declares {{count}} dependencies; the limit is {{max}}. Extract a service.",
      notInterface: "{{name}}.{{field}} is {{kind}}, not an interface: depend on a port or a service.",
    },
  },
  create(context) {
    const typed = typedServices(context);
    if (!typed) return {};
    const { checker, toTs } = typed;
    const options = /** @type {{ maxDependencies?: number } | undefined} */ (context.options[0]);
    const max = options?.maxDependencies ?? DEFAULT_MAX_DEPENDENCIES;

    return {
      TSInterfaceDeclaration(/** @type {unknown} */ estree) {
        const node = /** @type {InterfaceNode} */ (as(estree));
        const name = node.id.name ?? "";
        if (!name.endsWith(DEPENDENCIES_SUFFIX)) return;
        const members = node.body.body;
        if (members.length > max) {
          context.report({
            node: reportable(node.id),
            messageId: "tooMany",
            data: { name, count: String(members.length), max: String(max) },
          });
        }
        for (const member of members) {
          const annotation =
            member.type === "TSPropertySignature" ? member.typeAnnotation?.typeAnnotation : undefined;
          const field = member.key.type === "Identifier" ? (member.key.name ?? "?") : "?";
          const kind = annotation ? kindOf(checker.getTypeAtLocation(toTs(annotation))) : "other";
          if (kind !== "interface") {
            context.report({
              node: reportable(member),
              messageId: "notInterface",
              data: { name, field, kind: describe(kind) },
            });
          }
        }
      },
    };
  },
};

export default dependenciesAreInterfaces;
