// Violation (use-cases-no-use-cases): a use case importing another use case.
import { RecordUseCase } from "./record.use-case.js";

export class BadChainUseCase {
  readonly #inner = new RecordUseCase();
  execute(): Promise<void> {
    return this.#inner.execute();
  }
}
