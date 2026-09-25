// What can be said for a batch. The claim under test is the one the whole feature turns on: a family
// without a curated text is **not a candidate** (01 §322), and that is a different fact from every
// candidate being unsustainable — `message-unavailable` against `no-acceptable-candidate`. Confusing
// the two is what FR-016 of feature 027 forbids, and what the integration suite caught once already.
import { describe, expect, it } from "vitest";
import {
  Candidates,
  type MerchantPolicies,
  type MessageRequest,
} from "../../../../src/application/decision/index.js";
import { Signals } from "../../../../src/domain/barrier/index.js";
import { CANDIDATES, type Sayable } from "../../../../src/domain/selection/index.js";
import { BARRIERS, type MerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { TEST_VERSIONS } from "../../../helpers/platform.js";
import { sayable } from "../../../helpers/sayable.js";
import { testLevels } from "../../../helpers/test-app.js";
import type { BarrierInference } from "../../../../src/application/barrier/index.js";

const MERCHANT = "m_a" as MerchantId;
const { values } = testLevels().defaults;

const policies = (over: Partial<MerchantPolicies> = {}): MerchantPolicies => ({
  decision: values.decisionPolicy,
  commercial: values.commercialPolicy,
  profile: { returnsPolicy: true, fitData: true, authorizedAttributes: [] },
  barriers: BARRIERS,
  versions: TEST_VERSIONS,
  enabled: true,
  ...over,
});

/** An inference that hands the fit barrier all the confidence there is. */
const certainFit: BarrierInference = {
  infer: () => Promise.resolve({ confidences: { fit: 1, price: 0, returns: 0 }, matched: [] }),
};

/** The requests the plane made of the corpus, so a test can say what it was asked. */
const asked: MessageRequest[] = [];
const messagesThatSay = (answer: (request: MessageRequest) => readonly Sayable[]) => ({
  sayable: (request: MessageRequest) => {
    asked.push(request);
    return Promise.resolve(answer(request));
  },
});

const ask = (messages: { sayable: (r: MessageRequest) => Promise<readonly Sayable[]> }, locale?: string) =>
  new Candidates({ inference: certainFit, messages }).for({
    merchantId: MERCHANT,
    policies: policies(),
    signals: Signals.of([]),
    product: { attributes: new Map(), available: true },
    truth: { kind: "known", stockAndPrice: "fresh", available: true },
    evidence: { attributes: new Map(), stockAndPriceFresh: true, available: true },
    abandoned: false,
    attributes: new Map(),
    ...(locale === undefined ? {} : { locale }),
  });

describe("Candidates.for — what can be said", () => {
  it("with nothing sayable the reason is message-unavailable, never no-acceptable-candidate", async () => {
    const result = await ask(messagesThatSay(() => []));
    expect(result.judged).toEqual([]);
    expect(result.unsustainable).toBe("message-unavailable");
  });

  it("with something sayable it judges it and claims no reason of its own", async () => {
    const result = await ask(messagesThatSay(({ candidates }) => sayable(candidates)));
    expect(result.judged.map((j) => j.candidate.step)).toEqual(
      CANDIDATES.fit.map((candidate) => candidate.step),
    );
    expect(result.unsustainable).toBeUndefined();
  });

  it("asks only for the candidates of the barrier it settled on, and passes the page language", async () => {
    asked.length = 0;
    await ask(
      messagesThatSay(({ candidates }) => sayable(candidates)),
      "es-AR",
    );
    expect(asked.at(-1)?.candidates).toEqual(CANDIDATES.fit);
    expect(asked.at(-1)?.locale).toBe("es-AR");
  });

  it("passes no language when the page declared none, instead of passing an absent one", async () => {
    asked.length = 0;
    await ask(messagesThatSay(({ candidates }) => sayable(candidates)));
    const last = asked.at(-1);
    // An absent key and a key holding undefined are not the same request: the corpus asks the
    // directory for the reserve language only when the page declared none.
    expect(last === undefined ? "no request" : "locale" in last).toBe(false);
  });
});
