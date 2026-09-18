// Lint fixture (as if under src/application/<module>/use-cases/): violates only ope/use-case-shape.
// The class has no UseCase suffix, does not implement the contract and takes two constructor
// parameters instead of one *Dependencies interface.
import type { Clock } from "../../../../../../../src/application/shared-kernel/index.js";

export class DemoHandler {
  readonly #clock: Clock;
  readonly #label: string;

  constructor(clock: Clock, label: string) {
    this.#clock = clock;
    this.#label = label;
  }

  run(): string {
    return `${this.#label}@${this.#clock.now().toISOString()}`;
  }
}
