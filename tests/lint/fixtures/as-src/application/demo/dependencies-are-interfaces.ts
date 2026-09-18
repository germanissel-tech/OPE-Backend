// Lint fixture (as if under src/application/): violates only ope/dependencies-are-interfaces.
// One field is a class (an implementation, not a port) and the interface exceeds six fields.
import type { Clock, Logger, UseCase } from "../../../../../../src/application/shared-kernel/index.js";

export class MemoryStore {
  readonly items: string[] = [];
}

export interface TooManyDependencies {
  clock: Clock;
  ids: Logger;
  logger: Logger;
  store: MemoryStore;
  a: Clock;
  b: Clock;
  c: Clock;
}

export class DemoUseCase implements UseCase<void, number> {
  readonly #deps: TooManyDependencies;

  constructor(deps: TooManyDependencies) {
    this.#deps = deps;
  }

  execute(): Promise<number> {
    return Promise.resolve(this.#deps.store.items.length);
  }
}
