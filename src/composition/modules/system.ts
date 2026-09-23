// system module: service health. What it owns is what the deployment says of the contract it
// serves; the document itself comes from the release, and this module turns it into the only
// thing the use case needs to know about it.
import { GetServiceHealthUseCase, type ContractInfo } from "../../application/system/index.js";
import { contractInfoOf, makeGetHealth } from "../../interface-adapters/system/index.js";
import { bind, compositionModule, port, served } from "../graph/index.js";
import { ContractPort } from "../release.js";
import { ClockPort } from "./shared-kernel.js";

const ContractInfoPort = port("system.contract-info")<ContractInfo>();

export const systemModule = compositionModule({
  provides: [
    bind(ContractInfoPort, { contract: ContractPort }, ({ contract }) =>
      contractInfoOf(contract.info.version),
    ),
  ],
  serves: {
    handlers: {
      getHealth: served(
        { contract: ContractInfoPort, clock: ClockPort },
        // The name of the log is the name of the use case, which is not this operationId.
        { name: "getServiceHealth", build: (deps) => new GetServiceHealthUseCase(deps) },
        (useCase) => makeGetHealth(useCase),
      ),
    },
  },
});
