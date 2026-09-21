// Feature 017 — US4 (01 §3.1.1, §14.2; constitution XI): what the SDK reads of its merchant — the
// switch as the merchant is now and what the configuration lets it see — and what it reports:
// unresolved anchors kept per key with the instant, or refused whole when the store is down.
import { describe, expect, it } from "vitest";
import {
  GetSdkConfigUseCase,
  ListAnchorDiagnosticsUseCase,
  ReportAnchorDiagnosticsUseCase,
  type AnchorDiagnosticsStore,
  type SdkConfigurationView,
} from "../../../../src/application/admin/index.js";
import { DefaultScopedMerchantService } from "../../../../src/application/merchant/index.js";
import { asOperatorId, EVERY_MERCHANT, Operator } from "../../../../src/domain/operator/index.js";
import { asMerchantId, fail, StoreUnavailable } from "../../../../src/domain/shared-kernel/index.js";
import { memoryAnchorDiagnosticsStore } from "../../../../src/interface-adapters/gateways/admin/memory-anchor-diagnostics-store.js";
import { memoryMerchantStore } from "../../../../src/interface-adapters/gateways/merchant/memory-merchant-store.js";
import { TEST_NOW, testMerchant } from "../../../helpers/merchants.js";

const A = asMerchantId("m_a");
const VIEW: SdkConfigurationView = {
  versions: { platform: "platform-1", defaults: "defaults-1", merchant: 2 },
  surfaces: ["product"],
  locales: { supported: ["es-AR"] },
  anchors: { price: { selectors: [".price"] } },
};

describe("GetSdkConfigUseCase", () => {
  it("answers the view of the configuration with the switch as the merchant is now", async () => {
    const asked: string[] = [];
    const useCase = new GetSdkConfigUseCase({
      configuration: {
        sdkConfigurationFor: (merchantId) => {
          asked.push(merchantId);
          return Promise.resolve(VIEW);
        },
      },
    });
    const on = testMerchant({ merchantId: "m_a" });
    expect(await useCase.execute({ merchant: on })).toEqual({ enabled: true, ...VIEW });
    const off = on.switched(false);
    if (!off.ok) throw new Error(off.error.message);
    expect(await useCase.execute({ merchant: off.value })).toEqual({ enabled: false, ...VIEW });
    expect(asked).toEqual([A, A]);
  });
});

describe("ReportAnchorDiagnosticsUseCase", () => {
  it("keeps every unresolved anchor of the report under the merchant with the instant and the version, and counts repeats", async () => {
    const diagnostics = memoryAnchorDiagnosticsStore(10);
    const useCase = new ReportAnchorDiagnosticsUseCase({ diagnostics, clock: { now: () => TEST_NOW } });
    const received = await useCase.execute({
      merchantId: A,
      configurationVersion: 2,
      unresolved: [
        { anchor: "price", pageType: "product" },
        { anchor: "cta", pageType: "cart" },
        { anchor: "price", pageType: "product" },
      ],
    });
    expect(received.ok ? received.value : received.error).toEqual({ received: 3 });
    const page = await diagnostics.listOf(A, { limit: 10 });
    expect(page.items).toEqual([
      {
        merchantId: A,
        anchor: "price",
        pageType: "product",
        configurationVersion: 2,
        lastSeenAt: TEST_NOW,
        count: 2,
      },
      {
        merchantId: A,
        anchor: "cta",
        pageType: "cart",
        configurationVersion: 2,
        lastSeenAt: TEST_NOW,
        count: 1,
      },
    ]);
    const unversioned = await useCase.execute({
      merchantId: A,
      unresolved: [{ anchor: "price", pageType: "product" }],
    });
    expect(unversioned.ok).toBe(true);
    expect((await diagnostics.listOf(A, { limit: 10 })).items[0]).toMatchObject({
      anchor: "price",
      configurationVersion: undefined,
      count: 1,
    });
  });

  it("a store that cannot record answers store-unavailable and nothing is counted as received", async () => {
    const down: AnchorDiagnosticsStore = {
      upsert: () => Promise.resolve(fail(new StoreUnavailable())),
      listOf: () => Promise.resolve({ items: [] }),
    };
    const useCase = new ReportAnchorDiagnosticsUseCase({ diagnostics: down, clock: { now: () => TEST_NOW } });
    const result = await useCase.execute({
      merchantId: A,
      unresolved: [{ anchor: "cta", pageType: "product" }],
    });
    expect(result.ok ? undefined : result.error.code).toBe("store-unavailable");
  });
});

describe("ListAnchorDiagnosticsUseCase", () => {
  it("lists the diagnostics of the merchant within the scope of the operator; an unknown merchant is refused first", async () => {
    const merchants = memoryMerchantStore();
    await merchants.create(testMerchant({ merchantId: "m_a" }));
    const diagnostics = memoryAnchorDiagnosticsStore(10);
    await diagnostics.upsert({ merchantId: A, anchor: "price", pageType: "product", lastSeenAt: TEST_NOW });
    const useCase = new ListAnchorDiagnosticsUseCase({
      scoped: new DefaultScopedMerchantService({ merchants }),
      diagnostics,
    });
    const all = Operator.rehydrate({
      operatorId: asOperatorId("ops-all"),
      tokenFingerprints: [],
      scope: EVERY_MERCHANT,
    });
    const page = await useCase.execute({ actor: all, merchantId: A, page: { limit: 10 } });
    expect(page.ok ? page.value.items.map((d) => d.anchor) : page.error).toEqual(["price"]);
    const missing = await useCase.execute({
      actor: all,
      merchantId: asMerchantId("m_b"),
      page: { limit: 10 },
    });
    expect(missing.ok ? undefined : missing.error.code).toBe("merchant-not-found");
    const onlyB = Operator.rehydrate({
      operatorId: asOperatorId("ops-b"),
      tokenFingerprints: [],
      scope: [asMerchantId("m_b")],
    });
    const denied = await useCase.execute({ actor: onlyB, merchantId: A, page: { limit: 10 } });
    expect(denied.ok ? undefined : denied.error.code).toBe("merchant-out-of-scope");
  });
});
