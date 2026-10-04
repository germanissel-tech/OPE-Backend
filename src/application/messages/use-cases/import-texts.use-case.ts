// importTexts (feature 038): the texts the release file declares become version 1 of each key in the base
// layer, as the system operator, **only when the store holds no text at all** — like the merchants and the
// levels, the seed enters an empty store and never overwrites. From the second boot on, what is in force
// is what an operator published, and editing the file does nothing; the boot says so.
//
// **The completeness of the base is judged here and no longer at boot.** It is the rule the composition
// used to apply to the file against the reserve language of the release: now it is asked of the store,
// against every language the seeded levels support or name as reserve, once the seed is in. A seed that
// leaves the base incomplete does not start the server (constitution II): silence would be the normal
// answer. After the seed, the rule lives in the publications (feature 038, FR-018).
import {
  BaseTexts,
  LocaleIncomplete,
  TextVersion,
  type TextDraftError,
  type TextKeyRecord,
} from "../../../domain/messages/index.js";
import {
  fail,
  ok,
  type ConfigurationReasonRequired,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { TextStore } from "../ports/text-store.js";

/** One text of the seed: its key and what it says, as the file declares them. */
export interface SeedText {
  key: TextKeyRecord;
  text: string;
}

export interface ImportTextsRequest {
  actor: Operator;
  texts: readonly SeedText[];
  /** The languages the seeded levels support or name as reserve: what the base has to be complete in. */
  locales: readonly string[];
}

export type ImportTextsResponse = Result<
  { imported: number } | { outcome: "skipped" },
  TextDraftError | LocaleIncomplete | ConfigurationReasonRequired | StoreUnavailable
>;

export interface ImportTextsDependencies {
  texts: TextStore;
  clock: Clock;
}

export class ImportTextsUseCase implements UseCase<ImportTextsRequest, ImportTextsResponse> {
  readonly #deps: ImportTextsDependencies;

  constructor(deps: ImportTextsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ImportTextsRequest): Promise<ImportTextsResponse> {
    const { texts, clock } = this.#deps;
    if (!(await texts.isEmpty())) return ok({ outcome: "skipped" });
    for (const seed of request.texts) {
      const draft = TextVersion.draft({
        key: seed.key,
        text: seed.text,
        corrective: false,
        publishedAt: clock.now(),
        operatorId: request.actor.operatorId,
      });
      if (!draft.ok) return fail(draft.error);
      const published = await texts.publish(draft.value);
      if (!published.ok) return fail(published.error);
    }
    // Judged on the seed itself and not read back from the store: the store was empty, so the base after
    // this is exactly the seed — and this runs inside the unit of work of the audit, where a durable gateway
    // shows what it wrote only after the unit commits (ADR-041, feature 034).
    const base = BaseTexts.of(request.texts.map((seed) => seed.key));
    for (const locale of request.locales) {
      const missing = base.missingFor(locale);
      if (missing.length > 0) return fail(new LocaleIncomplete(locale, missing.join(", ")));
    }
    return ok({ imported: request.texts.length });
  }
}
