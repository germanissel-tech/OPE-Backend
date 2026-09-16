// FR-001, FR-002, FR-004 (ADR-013): anillos, módulos y mapa de contextos se hacen cumplir.
// (a) src/ no tiene violaciones; (b) cada regla atrapa la violación de su fixture.
import { createRequire } from "node:module";
import path from "node:path";
import { cruise, type ICruiseOptions, type IForbiddenRuleType } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const config = require(path.resolve(".dependency-cruiser.cjs")) as {
  forbidden: IForbiddenRuleType[];
  options: ICruiseOptions;
};

interface Violation {
  rule: { name: string };
  from: string;
  to: string;
}

async function violations(dir: string): Promise<Violation[]> {
  const result = await cruise([dir], {
    ...config.options,
    ruleSet: { forbidden: config.forbidden },
    validate: true,
    outputType: "json",
  });
  const output =
    typeof result.output === "string"
      ? (JSON.parse(result.output) as { summary: { violations: Violation[] } })
      : (result.output as { summary: { violations: Violation[] } });
  return output.summary.violations;
}

describe("arquitectura por anillos y módulos (dependency-cruiser)", () => {
  it("src/ respeta la dirección de dependencias", async () => {
    const found = await violations("src");
    expect(found.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)).toEqual([]);
  });

  it("cada regla atrapa la violación de su fixture", async () => {
    const found = await violations("tests/architecture/fixtures/src");
    const byRule = (name: string) =>
      found.filter((v) => v.rule.name === name).map((v) => `${v.from} -> ${v.to}`);
    const expectRule = (name: string, from: string) => {
      expect(byRule(name), name).toContainEqual(expect.stringContaining(from));
    };
    // Anillos
    expectRule("domain-is-pure", "domain/ingestion/bad-npm.ts");
    expectRule("domain-inward", "domain/ingestion/bad-application.ts");
    expectRule("application-inward", "application/ledger/bad-adapter.ts");
    expectRule("application-is-pure", "application/ledger/bad-npm.ts");
    expectRule("adapters-inward", "interface-adapters/http/controllers/x/bad-infra.ts");
    expectRule("infrastructure-inward", "infrastructure/http/bad-composition.ts");
    expectRule("nobody-imports-composition", "some/bad-composition.ts");
    expectRule("nobody-imports-main", "some/bad-main.ts");
    // Módulos
    expectRule("modules-only-via-index", "application/ledger/bad-internal-import.ts");
    expectRule("context-map:ledger", "domain/ledger/bad-context.ts");
    expectRule("context-map:shared-kernel", "domain/shared-kernel/bad-context.ts");
    expectRule("gateways-no-cross", "interface-adapters/gateways/a/bad-cross.ts");
    expectRule("controllers-no-gateways", "interface-adapters/http/controllers/x/bad-gateway.ts");
  });

  it("los módulos legítimos del fixture no disparan ninguna regla", async () => {
    const found = await violations("tests/architecture/fixtures/src");
    const legit = found.filter((v) => !v.from.includes("bad-") && v.rule.name !== "no-orphans");
    expect(legit.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)).toEqual([]);
  });
});
