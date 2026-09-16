// US5 (FR-017, FR-040; ADR-014): reglas puras del merchant — orígenes y claves de ingesta.
import { describe, expect, it } from "vitest";
import { findByIngestKey, originAllowed, type Merchant } from "../../../../src/domain/merchant/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const merchant: Merchant = {
  merchantId: asMerchantId("m_a"),
  ingestKeys: ["key-a-1", "key-a-2"],
  origins: ["https://a.example", "https://Shop.A.example:8443"],
};

describe("originAllowed", () => {
  it("acepta el origen registrado exacto (scheme + host + port)", () => {
    expect(originAllowed(merchant, "https://a.example")).toBe(true);
    expect(originAllowed(merchant, "https://shop.a.example:8443")).toBe(true);
  });

  it("el host se compara sin distinguir mayúsculas; scheme y port sí cuentan", () => {
    expect(originAllowed(merchant, "https://A.EXAMPLE")).toBe(true);
    expect(originAllowed(merchant, "http://a.example")).toBe(false);
    expect(originAllowed(merchant, "https://a.example:8443")).toBe(false);
  });

  it("no acepta subdominios, paths ni orígenes de otro merchant", () => {
    expect(originAllowed(merchant, "https://evil.a.example")).toBe(false);
    expect(originAllowed(merchant, "https://a.example/checkout")).toBe(false);
    expect(originAllowed(merchant, "https://b.example")).toBe(false);
    expect(originAllowed(merchant, "null")).toBe(false);
  });

  it("sin Origin (servidor a servidor, pruebas) se permite: el control es del par credencial/origen", () => {
    expect(originAllowed(merchant, undefined)).toBe(true);
  });
});

describe("findByIngestKey", () => {
  const other: Merchant = {
    merchantId: asMerchantId("m_b"),
    ingestKeys: ["key-b-1"],
    origins: ["https://b.example"],
  };
  const all = [merchant, other];

  it("resuelve cualquiera de las dos claves activas del merchant (rotación, FR-017)", () => {
    expect(findByIngestKey(all, "key-a-1")?.merchantId).toBe("m_a");
    expect(findByIngestKey(all, "key-a-2")?.merchantId).toBe("m_a");
    expect(findByIngestKey(all, "key-b-1")?.merchantId).toBe("m_b");
  });

  it("una clave desconocida, vacía o con distinto case no resuelve a nadie", () => {
    expect(findByIngestKey(all, "key-c-1")).toBeUndefined();
    expect(findByIngestKey(all, "")).toBeUndefined();
    expect(findByIngestKey(all, "KEY-A-1")).toBeUndefined();
  });
});
