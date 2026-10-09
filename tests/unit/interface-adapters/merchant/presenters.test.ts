// Feature 041 (ADR-045): the identity crosses the boundary as the contract publishes it — an absent
// field is absent, not `undefined` — in both directions.
import { describe, expect, it } from "vitest";
import { MerchantProfile } from "../../../../src/domain/merchant/index.js";
import {
  identityDto,
  merchantDto,
  profileOf,
} from "../../../../src/interface-adapters/merchant/presenters.js";
import { TEST_NOW, testMerchant } from "../../../helpers/merchants.js";

const valid = (record: Parameters<typeof MerchantProfile.of>[0]): MerchantProfile => {
  const r = MerchantProfile.of(record);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe("identityDto", () => {
  it("publishes only the fields the merchant has, the contact included", () => {
    expect(identityDto(undefined)).toStrictEqual({});
    expect(identityDto(valid({ displayName: "Norte" }))).toStrictEqual({ displayName: "Norte" });
    expect(
      identityDto(
        valid({
          displayName: "Norte",
          storeUrl: "https://n.example",
          contact: { name: "Ana", email: "a@n.example" },
          notes: "x",
        }),
      ),
    ).toStrictEqual({
      displayName: "Norte",
      storeUrl: "https://n.example",
      contact: { name: "Ana", email: "a@n.example" },
      notes: "x",
    });
    expect(
      identityDto(valid({ contact: { name: "Ana", email: "a@n.example", phone: "1", role: "r" } })),
    ).toStrictEqual({
      contact: { name: "Ana", email: "a@n.example", phone: "1", role: "r" },
    });
  });

  it("merchantDto carries the identity next to the operative facts", () => {
    const merchant = testMerchant({ merchantId: "m_p" }).withProfile(valid({ displayName: "P" }));
    const dto = merchantDto(merchant, TEST_NOW);
    expect(dto.displayName).toBe("P");
    expect(dto).not.toHaveProperty("storeUrl");
    expect(merchantDto(testMerchant({ merchantId: "m_q" }), TEST_NOW)).not.toHaveProperty("displayName");
  });
});

describe("profileOf", () => {
  it("reads the four fields of a body as written, copying the contact", () => {
    const contact = { name: "Ana", email: "a@n.example" };
    const record = profileOf({ displayName: "N", storeUrl: "https://n.example", contact, notes: "x" });
    expect(record).toEqual({ displayName: "N", storeUrl: "https://n.example", contact, notes: "x" });
    expect(record.contact).not.toBe(contact);
    expect(profileOf({ displayName: "N" })).toEqual({
      displayName: "N",
      storeUrl: undefined,
      contact: undefined,
      notes: undefined,
    });
  });
});
