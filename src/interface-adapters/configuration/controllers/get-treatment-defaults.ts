// getTreatmentDefaults (constitution XI, ADR-031): use case → 200 with level 2 of the release.
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { treatmentDefaultsDto } from "../presenters.js";
import type { GetTreatmentDefaultsRequest } from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { TreatmentDefaults } from "../../../domain/configuration/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetTreatmentDefaults(
  getDefaults: UseCase<GetTreatmentDefaultsRequest, TreatmentDefaults>,
): OperationHandler<"getTreatmentDefaults"> {
  return async (req) => ({
    status: HTTP_STATUS.OK,
    body: treatmentDefaultsDto(await getDefaults.execute({ actor: operatorOf(req) })),
  });
}
