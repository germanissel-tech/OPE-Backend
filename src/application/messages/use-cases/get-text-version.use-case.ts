// getTextVersion (feature 038, US5): one version of a base key, by its number, as it was published — what
// every intervention that stamped its identifier showed. Immutable, so what it answers today is what it
// answered the day it was created. A number nobody published never existed, and a key outside the
// vocabulary has no versions at all: both are a `404`, not an empty answer.
import {
  TextKey,
  TextVersionNotFound,
  type TextKeyInput,
  type TextVersion,
} from "../../../domain/messages/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { TextStore } from "../ports/text-store.js";

export interface GetTextVersionRequest {
  key: TextKeyInput;
  version: number;
}

export type GetTextVersionResponse = Result<TextVersion, TextVersionNotFound>;

export interface GetTextVersionDependencies {
  texts: TextStore;
}

export class GetTextVersionUseCase implements UseCase<GetTextVersionRequest, GetTextVersionResponse> {
  readonly #deps: GetTextVersionDependencies;

  constructor(deps: GetTextVersionDependencies) {
    this.#deps = deps;
  }

  async execute(request: GetTextVersionRequest): Promise<GetTextVersionResponse> {
    const key = TextKey.of(request.key);
    const found = key.ok
      ? await this.#deps.texts.versionOf(undefined, key.value.record(), request.version)
      : undefined;
    return found === undefined ? fail(TextVersionNotFound.numbered(request.version)) : ok(found);
  }
}
