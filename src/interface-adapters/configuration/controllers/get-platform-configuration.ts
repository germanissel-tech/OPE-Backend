// getPlatformConfiguration (constitution XI, ADR-031): use case → 200 with level 1 of the release.
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { platformDto } from "../presenters.js";
import type { GetPlatformConfigurationRequest } from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { PlatformConfiguration } from "../../../domain/configuration/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetPlatformConfiguration(
  getPlatform: UseCase<GetPlatformConfigurationRequest, PlatformConfiguration>,
): OperationHandler<"getPlatformConfiguration"> {
  return async (req) => ({
    status: HTTP_STATUS.OK,
    body: platformDto(await getPlatform.execute({ actor: operatorOf(req) })),
  });
}
