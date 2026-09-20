// Admin module (ADR-031): the operators of OPE, the admin log and the anchor diagnostics. It
// wires the `adminToken` security scheme the way merchant wires the credentials of the SDK and
// the platform, and serves the operations that are of the platform rather than of one merchant.
import {
  DefaultAdminTokenResolver,
  ListAdminLogUseCase,
  ListMerchantAdminLogUseCase,
  type AdminLog,
  type AnchorDiagnosticsStore,
  type OperatorDirectory,
  type TokenFingerprinter,
} from "../../application/admin/index.js";
import { LoggedUseCase, type Clock, type Logger } from "../../application/shared-kernel/index.js";
import { configOperatorDirectory } from "../../interface-adapters/gateways/admin/config-operator-directory.js";
import { memoryAdminLog } from "../../interface-adapters/gateways/admin/memory-admin-log.js";
import { memoryAnchorDiagnosticsStore } from "../../interface-adapters/gateways/admin/memory-anchor-diagnostics-store.js";
import { nodeTokenFingerprinter } from "../../interface-adapters/gateways/admin/node-token-fingerprinter.js";
import { makeListAdminLog } from "../../interface-adapters/http/controllers/admin/list-admin-log.js";
import { makeListMerchantAdminLog } from "../../interface-adapters/http/controllers/admin/list-merchant-admin-log.js";
import {
  ADMIN_TOKEN_HEADER,
  ADMIN_TOKEN_SCHEME,
  makeAdminTokenSecurity,
} from "../../interface-adapters/http/security/admin-token.js";
import type { Operator } from "../../domain/operator/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface AdminPorts {
  clock: Clock;
  logger: Logger;
  operators: OperatorDirectory;
  fingerprints: TokenFingerprinter;
  adminLog: AdminLog;
  diagnostics: AnchorDiagnosticsStore;
}

/** Diagnostics kept per merchant until the platform configuration (US2) says otherwise. */
const DIAGNOSTICS_KEPT = 200;

/** Operators as the configuration lists them; fingerprints with Node's crypto. */
export const configAdminPorts = (
  operators: readonly Operator[],
): Bindings<Pick<AdminPorts, "operators" | "fingerprints">> => ({
  operators: () => configOperatorDirectory(operators),
  fingerprints: () => nodeTokenFingerprinter,
});

export const memoryAdminPorts: Bindings<Pick<AdminPorts, "adminLog" | "diagnostics">> = {
  adminLog: memoryAdminLog,
  diagnostics: () => memoryAnchorDiagnosticsStore(DIAGNOSTICS_KEPT),
};

export const adminModule: Module<AdminPorts> = ({ ports }) => {
  const { clock, logger, adminLog } = ports;
  const resolver = new DefaultAdminTokenResolver({
    operators: ports.operators,
    fingerprints: ports.fingerprints,
  });
  const listAdminLog = new LoggedUseCase("listAdminLog", new ListAdminLogUseCase({ log: adminLog }), {
    clock,
    logger,
  });
  return {
    security: {
      [ADMIN_TOKEN_SCHEME]: {
        handler: makeAdminTokenSecurity(resolver),
        header: ADMIN_TOKEN_HEADER,
        consumer: "server",
      },
    },
    handlers: {
      listAdminLog: makeListAdminLog(listAdminLog),
      listMerchantAdminLog: makeListMerchantAdminLog(
        new LoggedUseCase("listMerchantAdminLog", new ListMerchantAdminLogUseCase({ log: adminLog }), {
          clock,
          logger,
        }),
      ),
    },
  };
};
