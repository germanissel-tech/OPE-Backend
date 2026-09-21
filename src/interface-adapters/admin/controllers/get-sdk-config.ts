// getSdkConfig (01 §3.1.1; constitution XI): the merchant of the credential → use case → 200 with
// what the SDK may see, never cacheable.
import { merchantOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import type { GetSdkConfigRequest, SdkConfig } from "../../../application/admin/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { components } from "../../http/generated/api.js";
import type { OperationHandler } from "../../http/typed.js";

type SdkConfigDto = components["schemas"]["SdkConfig"];

/** The configuration changes on the next request: nothing in between may keep it. */
const NO_STORE = { "cache-control": "no-store" };

function sdkConfigDto(config: SdkConfig): SdkConfigDto {
  const anchors = config.anchors as SdkConfigDto["anchors"];
  return {
    enabled: config.enabled,
    versions: config.versions,
    surfaces: [...config.surfaces],
    locales: { ...config.locales, supported: [...config.locales.supported] },
    ...(anchors === undefined ? {} : { anchors }),
  };
}

export function makeGetSdkConfig(
  getSdkConfig: UseCase<GetSdkConfigRequest, SdkConfig>,
): OperationHandler<"getSdkConfig"> {
  return async (req) => {
    const config = await getSdkConfig.execute({ merchant: merchantOf(req) });
    return { status: HTTP_STATUS.OK, body: sdkConfigDto(config), headers: NO_STORE };
  };
}
