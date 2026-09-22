// What the deployment says about the contract it serves (feature 020): the version of the
// document the server loaded. It takes the value, not the document: the use case that answers the
// health of the service has no business knowing the shape of a contract.
import type { ContractInfo } from "../../../application/system/index.js";

export function contractInfoOf(version: string): ContractInfo {
  return { version };
}
