// What an operator declares when it publishes a version, whichever level it is (feature 036).
//
// **It has a name because two use cases were writing the same four lines**, and the duplication gate said so:
// a merchant's version and a level's version differ in what they carry —declared values against a whole
// content— and agree on who published it, when, whether it is corrective and why. That quartet is the
// publication itself, and it is the same question at every level.
import type { Operator, OperatorId } from "../../../domain/operator/index.js";
import type { Clock } from "../../shared-kernel/index.js";

/** The four facts of a publication, in the shape both drafts expect. */
export interface Publication {
  corrective: boolean;
  reason?: string;
  publishedAt: Date;
  operatorId: OperatorId;
}

/** What a request and the clock say about a publication; the reason is absent, never `undefined`. */
export function publishedBy(
  // `reason?: string | undefined` and not `reason?: string`: one of the two requests declares it that way,
  // and with `exactOptionalPropertyTypes` the stricter shape does not accept the looser one.
  request: { actor: Operator; corrective: boolean; reason?: string | undefined },
  clock: Clock,
): Publication {
  return {
    corrective: request.corrective,
    ...(request.reason === undefined ? {} : { reason: request.reason }),
    publishedAt: clock.now(),
    operatorId: request.actor.operatorId,
  };
}
