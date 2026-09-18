// ADR-020/025: the capabilities a credential grants replicate `consumers.<name>.capabilities`
// of the contract map; the runtime check reads them, so the two cannot drift.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CONSUMER_CAPABILITIES } from "../../../src/interface-adapters/http/security/capabilities.js";

const map = parse(readFileSync("contracts/api-map.yaml", "utf8")) as {
  consumers: Record<string, { capabilities: string[] }>;
};

describe("consumer capabilities", () => {
  it.each(Object.keys(CONSUMER_CAPABILITIES) as (keyof typeof CONSUMER_CAPABILITIES)[])(
    "%s replicates exactly the map",
    (consumer) => {
      expect([...CONSUMER_CAPABILITIES[consumer]].sort()).toEqual(
        [...(map.consumers[consumer]?.capabilities ?? [])].sort(),
      );
    },
  );
});
