// ope/use-case-shape (ADR-023): a file under application/<module>/use-cases/ exports exactly one
// class, named *UseCase, that implements UseCase with an `execute` method, and whose constructor
// (if any) takes one parameter typed by a *Dependencies interface declared in the same file.
// What changes per call is the request; what the use case needs to operate is that object.
import { as, className, member, reportable } from "./_ast.mjs";

/** @import { Rule } from "eslint" */
/** @import { ClassNode, InterfaceNode } from "./_ast.mjs" */

const USE_CASE_SUFFIX = "UseCase";
const DEPENDENCIES_SUFFIX = "Dependencies";
const CONTRACT = "UseCase";
const EXECUTE = "execute";
const CONSTRUCTOR = "constructor";
const METHOD = "MethodDefinition";

/**
 * @param {ClassNode} cls
 * @returns {boolean}
 */
function implementsContract(cls) {
  return (cls.implements ?? []).some(
    (c) => c.expression.type === "Identifier" && c.expression.name === CONTRACT,
  );
}

/** @type {Rule.RuleModule} */
const useCaseShape = {
  meta: {
    type: "problem",
    docs: {
      description: "A use case file exports one *UseCase class implementing UseCase with typed dependencies.",
    },
    schema: [],
    messages: {
      exactlyOne: "A use case file exports exactly one class; this file exports {{count}}.",
      suffix: "A use case class is named *UseCase: rename {{name}}.",
      contract: "{{name}} does not implement UseCase<Request, Response>.",
      execute: "{{name}} has no `execute` method.",
      oneParameter: "The constructor of {{name}} takes exactly one parameter: the dependencies object.",
      dependenciesType:
        "The constructor of {{name}} takes a *Dependencies interface declared in this file, not {{type}}.",
    },
  },
  create(context) {
    /** @type {ClassNode[]} */
    const classes = [];
    /** @type {Set<string>} */
    const interfaces = new Set();

    /** @param {ClassNode} cls */
    const checkConstructor = (cls) => {
      const ctor = member(cls, METHOD, CONSTRUCTOR);
      if (!ctor?.value) return;
      const name = className(cls);
      const [param] = ctor.value.params;
      if (param === undefined || ctor.value.params.length !== 1) {
        context.report({ node: reportable(ctor), messageId: "oneParameter", data: { name } });
        return;
      }
      const reference = param.typeAnnotation?.typeAnnotation;
      const type = reference?.type === "TSTypeReference" ? reference.typeName?.name : undefined;
      if (type === undefined || !type.endsWith(DEPENDENCIES_SUFFIX) || !interfaces.has(type)) {
        context.report({
          node: reportable(param),
          messageId: "dependenciesType",
          data: { name, type: type ?? "(untyped)" },
        });
      }
    };

    return {
      TSInterfaceDeclaration(/** @type {unknown} */ node) {
        interfaces.add(/** @type {InterfaceNode} */ (as(node)).id.name ?? "");
      },
      ExportNamedDeclaration(node) {
        const declaration = /** @type {{ type: string } | null | undefined} */ (node.declaration);
        if (declaration?.type === "ClassDeclaration") classes.push(as(declaration));
      },
      "Program:exit"(program) {
        if (classes.length !== 1) {
          context.report({ node: program, messageId: "exactlyOne", data: { count: String(classes.length) } });
        }
        for (const cls of classes) {
          const name = className(cls);
          const node = reportable(cls);
          if (!name.endsWith(USE_CASE_SUFFIX)) context.report({ node, messageId: "suffix", data: { name } });
          if (!implementsContract(cls)) context.report({ node, messageId: "contract", data: { name } });
          if (!member(cls, METHOD, EXECUTE)) context.report({ node, messageId: "execute", data: { name } });
          checkConstructor(cls);
        }
      },
    };
  },
};

export default useCaseShape;
