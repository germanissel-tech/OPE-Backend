// The cross check of a language (feature 038, FR-010, FR-011; R-05): a language enters the supported list
// of a level or of a merchant only when the base layer holds a text for every unconditional family in it.
// A decorator, like the audit of the kernel: the two use cases that publish languages (feature 036) are at
// their six dependencies and the question is the same for both, so it is asked once, in front of them.
//
// **Only what enters is judged.** A language already supported stays whatever it was — the base never
// loses a text, so one that was complete still is, and one supported before this check existed is not
// retro-judged — and a language that leaves needs no texts. What enters is read against the version in
// force, which is why the decorator reads it and not the use case.
import {
  LocaleIncomplete,
  type DomainError,
  type Fail,
  type Result,
} from "../../../domain/shared-kernel/index.js";
import type { Locales } from "../../../domain/configuration/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { TextCompleteness } from "../ports/text-completeness.js";

/** How the decorator reads the languages of a request it does not otherwise know. */
export interface LocaleReaders<Request> {
  /** The languages the request declares, or undefined when it declares none. */
  declared: (request: Request) => Locales | undefined;
  /** The languages in force before the request, or undefined when nothing was published yet. */
  inForce: (request: Request) => Promise<Locales | undefined>;
  /** Where the request carries its languages, as a field path: what a refusal points at. */
  at: string;
}

export interface CompleteLocalesDependencies {
  completeness: TextCompleteness;
}

export class CompleteLocales<Request, Response extends Result<unknown, DomainError>> implements UseCase<
  Request,
  Response | Fail<LocaleIncomplete>
> {
  readonly #inner: UseCase<Request, Response>;
  readonly #deps: CompleteLocalesDependencies;
  readonly #readers: LocaleReaders<Request>;

  constructor(
    inner: UseCase<Request, Response>,
    deps: CompleteLocalesDependencies,
    readers: LocaleReaders<Request>,
  ) {
    this.#inner = inner;
    this.#deps = deps;
    this.#readers = readers;
  }

  async execute(request: Request): Promise<Response | Fail<LocaleIncomplete>> {
    const declared = this.#readers.declared(request);
    if (declared !== undefined) {
      const before = await this.#readers.inForce(request);
      for (const [index, locale] of declared.supported.entries()) {
        if (before?.supported.includes(locale) === true) continue;
        const missing = await this.#deps.completeness.missingFor(locale);
        if (missing.length > 0) {
          return {
            ok: false,
            error: new LocaleIncomplete(locale, missing.join(", "), `${this.#readers.at}.supported.${index}`),
          };
        }
      }
    }
    return this.#inner.execute(request);
  }
}
