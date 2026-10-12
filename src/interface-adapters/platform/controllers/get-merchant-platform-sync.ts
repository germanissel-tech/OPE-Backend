// getMerchantPlatformSync (feature 044; research R-10): path → use case → 200 with each flow, or 403 / 404 as
// Problem Details. What never happened is absent, never `null`.
import { merchantIdOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import type {
  FlowSync,
  GetPlatformSyncRequest,
  GetPlatformSyncResponse,
} from "../../../application/platform/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler, components } from "../../http/typed.js";

type EntryDto = components["schemas"]["PlatformSyncEntry"];

function entryDto({ mode, state }: FlowSync): EntryDto {
  return {
    mode,
    ...(state.lastRunAt === undefined ? {} : { lastRunAt: state.lastRunAt.toISOString() }),
    ...(state.lastOkAt === undefined ? {} : { lastOkAt: state.lastOkAt.toISOString() }),
    ...(state.lastOutcome === undefined ? {} : { lastOutcome: state.lastOutcome }),
  };
}

export function makeGetMerchantPlatformSync(
  getPlatformSync: UseCase<GetPlatformSyncRequest, GetPlatformSyncResponse>,
): OperationHandler<"getMerchantPlatformSync"> {
  return async (req) => {
    const result = await getPlatformSync.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    const { source, flows } = result.value;
    return {
      status: HTTP_STATUS.OK,
      body: {
        platform: source,
        flows: {
          catalog: entryDto(flows.catalog),
          stockAndPrice: entryDto(flows.stockAndPrice),
          orders: entryDto(flows.orders),
          returns: entryDto(flows.returns),
        },
      },
    };
  };
}
