// ope/domain-error-shape (ADR-023): in domain/<module>/errors.ts every exported class extends
// DomainError, declares a literal `code` and a literal `module` equal to the folder, and the file
// exports the union of its errors, so a consumer names "what can fail" with one type.
import { as, className, member, reportable } from "./_ast.mjs";
import { derivesFrom, literalOf, typedServices } from "./_typed.mjs";

/** @import { Rule } from "eslint" */
/** @import { ClassNode } from "./_ast.mjs" */

const ROOT = "DomainError";
const PROPERTY = "PropertyDefinition";
const ERRORS_FILE = /[\\/]domain[\\/]([^\\/]+)[\\/]errors\.ts$/;

/** @type {Rule.RuleModule} */
const domainErrorShape = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Errors of a module extend DomainError with literal code and module, and export their union.",
    },
    schema: [],
    messages: {
      root: "{{name}} does not extend DomainError.",
      code: '{{name}} needs a `code` whose type is a string literal (`readonly code = "slug" as const`).',
      module: '{{name}}.module is "{{actual}}"; the file lives in module "{{expected}}".',
      union: "domain/{{module}}/errors.ts exports no type: export the union of its errors.",
    },
  },
  create(context) {
    const match = ERRORS_FILE.exec(context.filename);
    const typed = typedServices(context);
    if (!match || !typed) return {};
    const expected = match[1] ?? "";
    const { checker, toTs } = typed;
    let exportsType = false;

    /**
     * @param {ClassNode} cls
     * @param {string} field
     * @returns {string | undefined}
     */
    const literalField = (cls, field) => {
      const node = member(cls, PROPERTY, field);
      return node ? literalOf(checker.getTypeAtLocation(toTs(node))) : undefined;
    };

    return {
      ExportNamedDeclaration(node) {
        const declaration = /** @type {{ type: string } | null | undefined} */ (node.declaration);
        if (declaration?.type === "TSTypeAliasDeclaration") exportsType = true;
        if (declaration?.type !== "ClassDeclaration") return;
        const cls = /** @type {ClassNode} */ (as(declaration));
        // The root itself (abstract, in the shared kernel) declares the shape; it does not have one.
        if (cls.abstract === true) return;
        const name = className(cls);
        const reported = reportable(cls);
        if (!derivesFrom(checker, checker.getTypeAtLocation(toTs(cls)), ROOT)) {
          context.report({ node: reported, messageId: "root", data: { name } });
        }
        if (literalField(cls, "code") === undefined) {
          context.report({ node: reported, messageId: "code", data: { name } });
        }
        const actual = literalField(cls, "module");
        if (actual !== expected) {
          context.report({
            node: reported,
            messageId: "module",
            data: { name, actual: actual ?? "(not literal)", expected },
          });
        }
      },
      "Program:exit"(program) {
        if (!exportsType) context.report({ node: program, messageId: "union", data: { module: expected } });
      },
    };
  },
};

export default domainErrorShape;
