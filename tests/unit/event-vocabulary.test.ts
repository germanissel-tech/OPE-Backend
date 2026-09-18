// Feature 011 (R-03): the runtime event vocabulary of the domain replicates the contract, so a
// decision policy can be validated against what OPE actually captures.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  BLOCKS,
  CHECKOUT_STEPS,
  CTA_APPROACHES,
  EVENT_TYPES,
  EXIT_SIGNALS,
  PHOTO_INTERACTIONS,
  SUBTYPES,
} from "../../src/domain/ingestion/index.js";

const schema = (
  name: string,
): {
  discriminator?: { mapping: Record<string, string> };
  properties?: Record<string, { enum?: string[] }>;
} => parse(readFileSync(`contracts/components/schemas/${name}.yaml`, "utf8")) as ReturnType<typeof schema>;

const enumOf = (name: string, property: string): string[] => {
  const values = schema(name).properties?.[property]?.enum;
  if (values === undefined) throw new Error(`${name}.${property} has no enum`);
  return values;
};

describe("event vocabulary", () => {
  it("event types replicate the discriminator mapping of Event", () => {
    const mapping = schema("Event").discriminator?.mapping ?? {};
    expect([...EVENT_TYPES].sort()).toEqual(Object.keys(mapping).sort());
  });

  it.each([
    ["BlockDwelled", "block", BLOCKS],
    ["PhotoInteracted", "interaction", PHOTO_INTERACTIONS],
    ["CtaApproached", "approach", CTA_APPROACHES],
    ["CheckoutAdvanced", "step", CHECKOUT_STEPS],
    ["ExitSignaled", "signal", EXIT_SIGNALS],
  ] as const)("%s.%s replicates the contract enum", (name, property, list) => {
    expect([...list].sort()).toEqual(enumOf(name, property).sort());
  });

  it("SUBTYPES lists exactly the types whose schema has a refining enum", () => {
    expect(Object.keys(SUBTYPES).sort()).toEqual(
      ["block_dwelled", "photo_interacted", "cta_approached", "checkout_advanced", "exit_signaled"].sort(),
    );
    expect(SUBTYPES.block_dwelled).toBe(BLOCKS);
  });
});
