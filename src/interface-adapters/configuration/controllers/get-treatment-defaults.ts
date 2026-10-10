// getTreatmentDefaults (constitution XI, ADR-031): use case → 200 with level 2 of the release.
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { treatmentDefaultsDto, witnessed } from "../presenters.js";
import type { GetTreatmentDefaultsRequest } from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { TreatmentDefaults } from "../../../domain/configuration/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetTreatmentDefaults(
  getDefaults: UseCase<GetTreatmentDefaultsRequest, TreatmentDefaults>,
): OperationHandler<"getTreatmentDefaults"> {
  return async (req) => {
    const body = treatmentDefaultsDto(await getDefaults.execute({ actor: operatorOf(req) }));
    // The witness of a level is the name of its version in force (feature 043, ADR-046).
    return { status: HTTP_STATUS.OK, body, headers: witnessed(body.version) };
  };
}
