// Fixture (feature 021, FR-007): an operation the contract orders audited, served by a use case
// whose request carries no operator, does not compile, and the message names the operation.
//
// Once the decoration is derived from the contract there is nothing left to forget — nobody
// chooses between logging and auditing any more. What the platform cannot check by itself is that
// the use case it was given can be audited at all: the entry needs the operator, and it reads it
// from the request. This is the error that appears when an administration write is wired to the
// wrong use case.
import { compositionModule, served } from "../../../src/composition/graph/index.js";
import type { UseCase } from "../../../src/application/shared-kernel/index.js";
import type { Handlers } from "../../../src/interface-adapters/http/typed.js";

/** No `actor`: nothing here says on whose behalf the switch was flipped. */
interface WithoutAnOperator {
  readonly enabled: boolean;
}

const anonymous: UseCase<WithoutAnOperator, undefined> = {
  execute: () => Promise.resolve(undefined),
};

// A controller that does satisfy the operation, so the only thing wrong with this module is the
// use case it hands to the audit.
declare const controller: NonNullable<Handlers["setKillSwitch"]>;

export const unauditable = compositionModule({
  serves: {
    handlers: {
      setKillSwitch: served({}, { name: "setKillSwitch", build: () => anonymous }, () => controller),
    },
  },
});
