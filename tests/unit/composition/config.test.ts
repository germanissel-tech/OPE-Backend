// Configuration is read once, at the entry, and either yields a complete AppConfig or refuses
// with the variable and the problem: no NaN port, no half-parsed merchants (fail-closed).
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "../../../src/composition/config.js";

const noFile = (file: string): string => {
  throw new Error(`unexpected read of ${file}`);
};
const merchant = { merchantId: "m_a", ingestKeys: ["k1"], origins: ["https://a.example"] };

describe("readConfig", () => {
  it("defaults: port 3000, loopback host, the bundled contract, no merchants", () => {
    expect(readConfig({}, noFile)).toEqual({
      port: 3000,
      host: "127.0.0.1",
      contractPath: path.resolve("contracts/dist/openapi.yaml"),
      merchants: [],
    });
  });

  it("reads PORT, HOST and OPE_CONTRACT; a blank variable counts as unset", () => {
    const config = readConfig({ PORT: " 8080 ", HOST: "0.0.0.0", OPE_CONTRACT: "x/openapi.yaml" }, noFile);
    expect(config).toMatchObject({
      port: 8080,
      host: "0.0.0.0",
      contractPath: path.resolve("x/openapi.yaml"),
    });
    expect(readConfig({ PORT: "", HOST: "  ", OPE_CONTRACT: "" }, noFile)).toMatchObject({
      port: 3000,
      host: "127.0.0.1",
      contractPath: path.resolve("contracts/dist/openapi.yaml"),
    });
  });

  it.each(["abc", "3000.5", "-1", "65536", "0x10"])("PORT=%s is refused by name, with the value", (raw) => {
    expect(() => readConfig({ PORT: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ PORT: raw }, noFile)).toThrow(
      `PORT must be an integer between 0 and 65535, got "${raw}".`,
    );
  });

  it("PORT=0 (a free port, for tests) and 65535 are valid", () => {
    expect(readConfig({ PORT: "0" }, noFile).port).toBe(0);
    expect(readConfig({ PORT: "65535" }, noFile).port).toBe(65535);
  });

  it("merchants come inline from OPE_MERCHANTS or from OPE_MERCHANTS_FILE, inline first", () => {
    expect(readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants).toEqual([merchant]);
    const read = (file: string): string => {
      expect(file).toBe(path.resolve("config/m.json"));
      return JSON.stringify([merchant, { ...merchant, merchantId: "m_b" }]);
    };
    expect(readConfig({ OPE_MERCHANTS_FILE: "config/m.json" }, read).merchants).toHaveLength(2);
    expect(
      readConfig({ OPE_MERCHANTS: "[]", OPE_MERCHANTS_FILE: "config/m.json" }, noFile).merchants,
    ).toEqual([]);
  });

  it.each([
    ["{not json", "OPE_MERCHANTS is not valid JSON ("],
    ['{"merchantId":"m"}', "OPE_MERCHANTS must be a JSON array of merchants."],
    ["[1]", "merchants[0] is not an object."],
    [
      '[{"merchantId":"","ingestKeys":["k"],"origins":["o"]}]',
      "merchants[0].merchantId must be a non-empty string.",
    ],
    [
      '[{"merchantId":"m","ingestKeys":[],"origins":["o"]}]',
      "merchants[0].ingestKeys must have one or two keys.",
    ],
    [
      '[{"merchantId":"m","ingestKeys":["a","b","c"],"origins":["o"]}]',
      "merchants[0].ingestKeys must have one or two keys.",
    ],
    [
      '[{"merchantId":"m","ingestKeys":["k"],"origins":[]}]',
      "merchants[0].origins must have at least one origin.",
    ],
  ])("OPE_MERCHANTS=%s is refused: %s", (raw, message) => {
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(message);
  });
});
