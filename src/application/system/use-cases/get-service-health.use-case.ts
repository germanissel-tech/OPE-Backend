// Use case: service status. Wraps the domain value with the injected clock. Cannot fail on
// business rules, so the response is the value itself (ADR-023).
import type { ServiceHealth } from "../../../domain/system/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { ContractInfo } from "../ports/contract-info.js";

export interface GetServiceHealthDependencies {
  contract: ContractInfo;
  clock: Clock;
}

export class GetServiceHealthUseCase implements UseCase<void, ServiceHealth> {
  readonly #deps: GetServiceHealthDependencies;

  constructor(deps: GetServiceHealthDependencies) {
    this.#deps = deps;
  }

  execute(): Promise<ServiceHealth> {
    const { contract, clock } = this.#deps;
    return Promise.resolve({ status: "ok", contractVersion: contract.version, timestamp: clock.now() });
  }
}
