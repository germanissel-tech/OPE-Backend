// Feature 038: the durable text store answers the corpus from an in-memory index, and **what this file is
// about is the one rule that keeps that sound** (ADR-041) — the index is a view of what the store accepted,
// so it is touched after a successful write and never before.
//
// It is here and not in the durability suite because it needs a store that **refuses**: the point is not
// that the file survives a restart but that a refused publication leaves the index alone. A gateway that
// updated the index first would answer a text the table does not have, and nothing downstream could tell.
import { describe, expect, it } from "vitest";
import { TextVersion, type TextDraft } from "../../../../src/domain/messages/index.js";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { sqliteTextStore } from "../../../../src/interface-adapters/messages/gateways/sqlite-text-store.js";
import { fakeLogger, fakeStore } from "../../../helpers/sql-store.js";
import type { SqlRow } from "../../../../src/interface-adapters/shared-kernel/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");
const KEY = { family: "fit.variant_selector.information", locale: "es" };
const UNO = asMerchantId("m_uno");

const draft = (over: Partial<TextDraft> = {}): TextDraft => ({
  key: KEY,
  text: "Base.",
  corrective: false,
  publishedAt: AT,
  operatorId: asOperatorId("ops"),
  ...over,
});

/** A table that holds `versions` and numbers the next one after the highest it holds. */
function subject(versions: readonly TextVersion[] = [], refuses = false) {
  const fake = fakeStore({
    refuses,
    answer: (sql): readonly SqlRow[] => {
      if (sql.includes("MAX(version)")) return [{ next: versions.length + 1 }];
      return versions.map((version) => ({ document: JSON.stringify(version.record()) }));
    },
  });
  const recorder = fakeLogger();
  const texts = sqliteTextStore({ store: fake.store, logger: recorder.logger });
  const reads = () =>
    fake.statements.filter((sql) => sql.startsWith("SELECT") && !sql.includes("MAX(")).length;
  return { texts, reads, logged: recorder.entries };
}

describe("sqliteTextStore", () => {
  it("fills its index once, when it is built, and answers every read of the decision path from it", async () => {
    const base = TextVersion.numbered(draft(), 1);
    const own = TextVersion.numbered(draft({ merchantId: UNO, text: "Own text." }), 1);
    const { texts, reads } = subject([base, own]);
    expect(reads()).toBe(1);
    expect((await texts.find(UNO, KEY))?.value).toBe("Own text.");
    expect((await texts.find(asMerchantId("m_dos"), KEY))?.value).toBe("Base.");
    expect((await texts.inForce(undefined, KEY))?.version).toBe(1);
    expect(await texts.baseKeys()).toEqual([KEY]);
    expect(await texts.isEmpty()).toBe(false);
    expect(reads()).toBe(1);
  });

  it("updates the index after the store accepted, so the next decision sees the text without a restart", async () => {
    const { texts } = subject([TextVersion.numbered(draft(), 1)]);
    const published = await texts.publish(draft({ text: "Base, corrected." }));
    expect(published.ok && published.value.version).toBe(2);
    expect((await texts.find(UNO, KEY))?.value).toBe("Base, corrected.");
  });

  it("leaves the index untouched when the store refused, so it never answers what was not written", async () => {
    const { texts, logged } = subject([TextVersion.numbered(draft(), 1)], true);
    const published = await texts.publish(draft({ merchantId: UNO, text: "Own text." }));
    expect(published.ok).toBe(false);
    expect(published.ok ? undefined : published.error.code).toBe("store-unavailable");
    expect((await texts.find(UNO, KEY))?.value).toBe("Base.");
    expect(logged.map((entry) => entry.fields["write"])).toEqual(["text"]);
  });

  it("a removal in force sends the merchant back to the base", async () => {
    const removed = TextVersion.numbered(
      Object.fromEntries(
        Object.entries(draft({ merchantId: UNO })).filter(([f]) => f !== "text"),
      ) as TextDraft,
      2,
    );
    const { texts } = subject([TextVersion.numbered(draft(), 1), removed]);
    expect((await texts.find(UNO, KEY))?.value).toBe("Base.");
    expect((await texts.inForce(UNO, KEY))?.isRemoved()).toBe(true);
  });
});
