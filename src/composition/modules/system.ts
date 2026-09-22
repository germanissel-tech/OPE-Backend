// system module: service health. It has no component of its own —nothing here is served by a
// technology— so it only serves its operation.
import { GetServiceHealthUseCase } from "../../application/system/index.js";
import { makeGetHealth } from "../../interface-adapters/system/index.js";
import { compositionModule, handler, technology } from "../graph/index.js";
import { ContractPort } from "../release.js";
import { ClockPort, DecoratorsPort } from "./shared-kernel.js";

export const systemModule = compositionModule({
  ports: [],
  technologies: { stateless: technology([], []) },
  serves: {
    handlers: {
      getHealth: handler(
        { deco: DecoratorsPort, contract: ContractPort, clock: ClockPort },
        // The name of the log is the name of the use case, which is not this operationId.
        (_operation, { deco, contract, clock }) =>
          makeGetHealth(
            deco.logged(
              "getServiceHealth",
              new GetServiceHealthUseCase({ contract: { version: contract.info.version }, clock }),
            ),
          ),
      ),
    },
  },
});
