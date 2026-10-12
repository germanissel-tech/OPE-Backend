// Feature 044, US4 (FR-012; research R-08): an entry by a mode that does not govern its flow is refused before
// the use case behind it runs, and the mode is read on every entry.
import { describe, expect, it } from "vitest";
import { ModeGatedUseCase, type SyncStrategies } from "../../../../src/application/shared-kernel/index.js";
import {
  asMerchantId,
  ok,
  type MerchantId,
  type SyncFlow,
  type SyncMode,
} from "../../../../src/domain/shared-kernel/index.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");

function subject(modes: Map<string, SyncMode>, gate: { flow: SyncFlow; mode: SyncMode }) {
  const calls: MerchantId[] = [];
  const asked: string[] = [];
  const strategies: SyncStrategies = {
    modeOf: (merchantId, flow) => {
      asked.push(`${merchantId}/${flow}`);
      return Promise.resolve(modes.get(`${merchantId}/${flow}`) ?? "push");
    },
  };
  const inner = {
    execute: (request: { merchantId: MerchantId }) => {
      calls.push(request.merchantId);
      return Promise.resolve(ok("done"));
    },
  };
  return { gated: new ModeGatedUseCase(inner, { strategies }, gate), calls, asked };
}

describe("ModeGatedUseCase", () => {
  it("with the flow in the mode of the entrance, the use case behind answers", async () => {
    const { gated, calls, asked } = subject(new Map([["m_a/orders", "pull"]]), {
      flow: "catalog",
      mode: "push",
    });
    expect(await gated.execute({ merchantId: A })).toEqual(ok("done"));
    expect(calls).toEqual([A]);
    expect(asked).toEqual(["m_a/catalog"]);
  });

  it("with the flow in another mode, sync-mode-not-configured and the use case never runs", async () => {
    const { gated, calls } = subject(new Map([["m_a/catalog", "pull"]]), { flow: "catalog", mode: "push" });
    const response = await gated.execute({ merchantId: A });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("sync-mode-not-configured");
      expect(response.error.details).toEqual({ flow: "catalog", configured: "pull" });
      expect(response.error.message).toBe("The flow catalog of this merchant arrives by pull.");
    }
    expect(calls).toEqual([]);
  });

  it("reads the mode of the merchant of the request, on every entry", async () => {
    const modes = new Map<string, SyncMode>([["m_b/returns", "subscribe"]]);
    const { gated, calls } = subject(modes, { flow: "returns", mode: "subscribe" });
    expect((await gated.execute({ merchantId: A })).ok).toBe(false);
    expect((await gated.execute({ merchantId: B })).ok).toBe(true);
    modes.set("m_b/returns", "push");
    expect((await gated.execute({ merchantId: B })).ok).toBe(false);
    expect(calls).toEqual([B]);
  });
});
