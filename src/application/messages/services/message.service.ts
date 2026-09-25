// The messages authority (feature 027; 01 §322): which candidate families can be said, and with
// what text. It implements the port the decision plane owns, so the plane never depends on the
// corpus.
//
// **The language rules over the voice.** A text in the wrong language is broken; one in the wrong
// voice is off-brand but understood. So the language resolves first —the page's, then the
// merchant's reserve language— and inside the language resolved the merchant's voice is tried and
// then the default one. Nothing resolves to a text in another language: the family stops being a
// candidate instead (01 §322).
import type { CuratedText } from "../../../domain/messages/index.js";
import type { Candidate, Sayable } from "../../../domain/selection/index.js";
import type { Voice } from "../../../domain/shared-kernel/index.js";
import type { MessagePlane, MessageRequest } from "../../decision/index.js";
import type { MessageCorpus } from "../ports/message-corpus.js";
import type { MessageDirectory, MessageSettings } from "../ports/message-directory.js";

export interface MessagesDependencies {
  corpus: MessageCorpus;
  directory: MessageDirectory;
}

export class Messages implements MessagePlane {
  readonly #corpus: MessageCorpus;
  readonly #directory: MessageDirectory;

  constructor(dependencies: MessagesDependencies) {
    this.#corpus = dependencies.corpus;
    this.#directory = dependencies.directory;
  }

  async sayable(request: MessageRequest): Promise<readonly Sayable[]> {
    const settings = await this.#directory.settingsFor(request.merchantId);
    const locales = localesOf(request.locale, settings);
    const resolved = await Promise.all(
      request.candidates.map(async (candidate) => this.#say(candidate, locales, settings.voice)),
    );
    // The order given is the order of the incentive ladder, and the ladder is what decides which
    // rung the commercial policy settles on: filtering must not reorder it.
    return resolved.filter((sayable): sayable is Sayable => sayable !== undefined);
  }

  /** The text for one candidate, language first and voice second, or undefined when there is none. */
  async #say(candidate: Candidate, locales: readonly string[], voice: Voice): Promise<Sayable | undefined> {
    for (const locale of locales) {
      const text = await this.#look(candidate, locale, voice);
      if (text !== undefined) {
        return { candidate, said: { messageVersionId: text.version, text: text.value } };
      }
    }
    return undefined;
  }

  async #look(candidate: Candidate, locale: string, voice: Voice): Promise<CuratedText | undefined> {
    return this.#corpus.find({ family: candidate.candidateId, locale, voice });
  }
}

/** The languages to try, in order: the page's, then the merchant's reserve language. */
function localesOf(pageLocale: string | undefined, settings: MessageSettings): readonly string[] {
  // A list of locales the corpus does not hold behaves exactly like none: the lookup misses and
  // nothing is sayable, so no test can tell an empty chain from a bogus one.
  // Stryker disable next-line ArrayDeclaration: no test distinguishes an empty chain from a bogus one
  if (pageLocale === undefined) return settings.fallback === undefined ? [] : [settings.fallback];
  return settings.fallback === undefined ? [pageLocale] : [pageLocale, settings.fallback];
}
