// Feature 004 — FR-001, FR-002, FR-004 (ADR-013): rings, modules and the context map are enforced.
// (a) src/ has no violations; (b) every rule catches the violation of its fixture.
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

describe("architecture by rings and modules (dependency-cruiser)", () => {
  it("src/ respects the dependency direction", async () => {
    const found = await violations("src");
    expect(found.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)).toEqual([]);
  });

  it("every rule catches the violation of its fixture", async () => {
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
    expectRule("adapters-inward", "interface-adapters/x/controllers/bad-infra.ts");
    expectRule("infrastructure-inward", "infrastructure/http/bad-composition.ts");
    expectRule("nobody-imports-composition", "some/bad-composition.ts");
    expectRule("nobody-imports-main", "some/bad-main.ts");
    expectRule("composition-wires-by-module", "composition/bad-wiring.ts");
    expectRule("profiles-compose-modules", "composition/profiles/bad-profile.ts");
    // Modules
    expectRule("modules-only-via-index", "application/ledger/bad-internal-import.ts");
    expectRule("context-map:ledger", "domain/ledger/bad-context.ts");
    expectRule("context-map:shared-kernel", "domain/shared-kernel/bad-context.ts");
    expectRule("gateways-no-cross", "interface-adapters/a/gateways/bad-cross.ts");
    // What the gateways share (015 F-033) is not a cross: the shared-kernel of the ring implements no port.
    expect(byRule("gateways-no-cross")).not.toContainEqual(expect.stringContaining("a/ok-shared-kernel.ts"));
    expectRule("controllers-no-gateways", "interface-adapters/x/controllers/bad-gateway.ts");
    // Adapters ring by module (feature 018)
    expectRule("modules-only-via-index", "interface-adapters/a/bad-internal-import.ts");
    expectRule("context-map:ledger", "interface-adapters/ledger/bad-context.ts");
    expectRule("adapters-core-knows-no-module", "interface-adapters/http/bad-module.ts");
    expectRule("composition-imports-module-index", "composition/modules/bad-deep-import.ts");
    expectRule("gateways-drivers-from-infrastructure", "interface-adapters/a/gateways/bad-driver.ts");
    // Application ring (ADR-023)
    expectRule("use-cases-no-use-cases", "application/ledger/use-cases/bad-use-case-chain.ts");
    expectRule("services-no-use-cases", "application/ledger/services/bad-service.ts");
    expectRule("problem-translation-only-in-http", "interface-adapters/c/gateways/bad-problem.ts");
  });

  it("the legitimate modules of the fixture trigger no rule", async () => {
    const found = await violations("tests/architecture/fixtures/src");
    const legit = found.filter((v) => !v.from.includes("bad-") && v.rule.name !== "no-orphans");
    expect(legit.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)).toEqual([]);
  });
});
