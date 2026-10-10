// getPlatformConfiguration (constitution XI, ADR-031): use case → 200 with level 1 of the release.
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { platformDto, witnessed } from "../presenters.js";
import type { GetPlatformConfigurationRequest } from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { PlatformConfiguration } from "../../../domain/configuration/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetPlatformConfiguration(
  getPlatform: UseCase<GetPlatformConfigurationRequest, PlatformConfiguration>,
): OperationHandler<"getPlatformConfiguration"> {
  return async (req) => {
    const body = platformDto(await getPlatform.execute({ actor: operatorOf(req) }));
    // The witness of a level is the name of its version in force (feature 043, ADR-046).
    return { status: HTTP_STATUS.OK, body, headers: witnessed(body.version) };
  };
}
