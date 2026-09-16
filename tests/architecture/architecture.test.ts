// FR-040 / FR-041 (ADR-006): la dirección de dependencias entre capas se hace cumplir.
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

describe("arquitectura por capas (dependency-cruiser)", () => {
  it("src/ respeta la dirección de dependencias", async () => {
    const found = await violations("src");
    expect(found.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)).toEqual([]);
  });

  it("cada regla atrapa la violación de su fixture", async () => {
    const found = await violations("tests/architecture/fixtures/src");
    const byRule = (name: string) =>
      found.filter((v) => v.rule.name === name).map((v) => `${v.from} -> ${v.to}`);
    expect(byRule("domain-is-pure")).toContainEqual(expect.stringContaining("domain/bad-npm.ts"));
    expect(byRule("domain-no-layers")).toContainEqual(expect.stringContaining("domain/bad-adapter.ts"));
    expect(byRule("ports-only-domain")).toContainEqual(expect.stringContaining("ports/bad-adapter.ts"));
    expect(byRule("adapters-no-cross")).toContainEqual(expect.stringContaining("adapters/x/bad-cross.ts"));
    expect(byRule("adapters-no-handlers")).toContainEqual(
      expect.stringContaining("adapters/x/bad-handlers.ts"),
    );
    expect(byRule("adapters-typed-only-types")).toContainEqual(
      expect.stringContaining("adapters/x/bad-typed-runtime.ts"),
    );
    expect(byRule("handlers-no-adapters")).toContainEqual(expect.stringContaining("handlers/bad-adapter.ts"));
    expect(byRule("handlers-no-runtime-npm")).toContainEqual(expect.stringContaining("handlers/bad-npm.ts"));
    expect(byRule("client-only-generated")).toContainEqual(expect.stringContaining("client/bad-domain.ts"));
    expect(byRule("nobody-imports-main")).toContainEqual(expect.stringContaining("some/bad-main.ts"));
  });

  it("los módulos legítimos del fixture no disparan reglas de capa", async () => {
    const found = await violations("tests/architecture/fixtures/src");
    const legit = found.filter((v) => !v.from.includes("bad-") && v.rule.name !== "no-orphans");
    expect(legit.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)).toEqual([]);
  });
});
