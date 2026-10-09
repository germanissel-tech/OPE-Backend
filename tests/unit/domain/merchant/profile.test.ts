// Feature 041 — US1, US2 (FR-006, FR-007; ADR-045): the identity of a merchant is a value with rules —
// no text padded or blank, a store URL that parses as one — kept as written; the merchant replaces
// it whole, whatever its status, and rehydrates it as a class.
import { describe, expect, it } from "vitest";
import {
  InvalidMerchantProfile,
  Merchant,
  MerchantProfile,
  type MerchantProfileRecord,
} from "../../../../src/domain/merchant/index.js";
import { testMerchant } from "../../../helpers/merchants.js";

const full: MerchantProfileRecord = {
  displayName: "Tienda Norte",
  storeUrl: "https://www.tiendanorte.example/es/",
  contact: {
    name: "Ana Smith",
    email: "ana@tiendanorte.example",
    phone: "+54 11 5555-0000",
    role: "e-commerce",
  },
  notes: "Pilot since October.",
};

const valid = (record: MerchantProfileRecord): MerchantProfile => {
  const r = MerchantProfile.of(record);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

const rejectedField = (record: MerchantProfileRecord): string | undefined => {
  const r = MerchantProfile.of(record);
  if (r.ok) return undefined;
  expect(r.error).toBeInstanceOf(InvalidMerchantProfile);
  expect(r.error).toMatchObject({ code: "invalid-merchant-profile", module: "merchant" });
  return String(r.error.details["pointer"]);
};

describe("MerchantProfile.of", () => {
  it("accepts the four fields as written, and none at all", () => {
    expect(valid(full).record()).toEqual(full);
    expect(valid({}).record()).toEqual({});
    expect(valid({ displayName: "Name only" }).displayName).toBe("Name only");
  });

  it.each([
    ["an empty display name", { displayName: "" }, "displayName"],
    ["a padded display name", { displayName: " Tienda" }, "displayName"],
    ["a display name padded at the end", { displayName: "Tienda " }, "displayName"],
    ["a store URL that is only a scheme", { storeUrl: "https://" }, "storeUrl"],
    ["a store URL with a space", { storeUrl: "http://a b.example" }, "storeUrl"],
    ["a store URL of another scheme", { storeUrl: "ftp://a.example" }, "storeUrl"],
    ["a padded store URL", { storeUrl: " https://a.example" }, "storeUrl"],
    ["a padded contact name", { contact: { name: " Ana", email: "a@b.example" } }, "contact.name"],
    ["a padded contact email", { contact: { name: "Ana", email: "a@b.example " } }, "contact.email"],
    ["blank notes", { notes: "   " }, "notes"],
  ] as const)("rejects %s naming its field", (_what, record, field) => {
    expect(rejectedField(record)).toBe(field);
  });

  it("names the first field broken, in the order they are written", () => {
    expect(rejectedField({ displayName: " X", storeUrl: "nope", notes: " " })).toBe("displayName");
    expect(rejectedField({ displayName: "X", storeUrl: "nope", notes: " " })).toBe("storeUrl");
  });

  it("the error says what is wrong with the field it names", () => {
    const url = MerchantProfile.of({ storeUrl: "nope" });
    expect(url.ok ? undefined : url.error.details).toEqual({
      pointer: "storeUrl",
      problem: "The store URL must parse as an absolute http(s) URL.",
    });
    const name = MerchantProfile.of({ displayName: " " });
    expect(name.ok ? undefined : name.error.message).toContain("leading or trailing whitespace");
  });

  it("accepts a store URL with a path, a port and a query: it is for a person to open", () => {
    expect(valid({ storeUrl: "http://localhost:3000/tienda?x=1" }).storeUrl).toBe(
      "http://localhost:3000/tienda?x=1",
    );
  });

  it("rehydrate does not re-judge, and the record is a copy", () => {
    const kept = MerchantProfile.rehydrate({ displayName: " padded ", contact: full.contact });
    expect(kept.displayName).toBe(" padded ");
    expect(kept.record().contact).toEqual(full.contact);
    expect(kept.record().contact).not.toBe(kept.contact);
  });
});

describe("Merchant with an identity", () => {
  it("is created with one, replaces it whole, and keeps the rest intact", () => {
    const merchant = testMerchant({ merchantId: "m_x" });
    expect(merchant.profile).toBeUndefined();
    const named = merchant.withProfile(valid(full));
    expect(named.profile?.record()).toEqual(full);
    expect(named.merchantId).toBe("m_x");
    expect(named.origins).toEqual(merchant.origins);
    expect(named.credentials).toEqual(merchant.credentials);
    expect(named.status).toBe(merchant.status);
    const renamed = named.withProfile(valid({ displayName: "Other" }));
    expect(renamed.profile?.record()).toEqual({ displayName: "Other" });
    expect(renamed.record().profile).toEqual({ displayName: "Other" });
  });

  it("a deactivated merchant admits it: the identity is of the commercial relationship", () => {
    const gone = testMerchant({ merchantId: "m_y" }).deactivated();
    const named = gone.withProfile(valid({ displayName: "Cerrada" }));
    expect(named.isDeactivated()).toBe(true);
    expect(named.profile?.displayName).toBe("Cerrada");
  });

  it("rehydrates the identity as a class, and a record without one as none", () => {
    const record = testMerchant({ merchantId: "m_z" }).withProfile(valid(full)).record();
    const back = Merchant.rehydrate({ ...record, profile: { ...full } });
    expect(back.profile).toBeInstanceOf(MerchantProfile);
    expect(back.profile?.record()).toEqual(full);
    const old = { ...record };
    delete old.profile;
    expect(Merchant.rehydrate(old).profile).toBeUndefined();
    expect(Merchant.rehydrate(old).record().profile).toBeUndefined();
  });

  it("the identity survives the other transitions", () => {
    const named = testMerchant({ merchantId: "m_w" }).withProfile(valid({ displayName: "Norte" }));
    const off = named.switched(false);
    expect(off.ok ? off.value.profile?.displayName : undefined).toBe("Norte");
    expect(named.deactivated().profile?.displayName).toBe("Norte");
  });
});
