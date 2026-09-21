// Merchant module (ADR-014, ADR-025, ADR-029, ADR-031): the merchants of the platform — their
// store, the security schemes of the SDK and the platform, and the administration of merchants
// and credentials. One store instance serves both the store and the directory the security
// handlers read: an administration change counts on the next request.
import { AuditedUseCase, type AdminLog } from "../../application/admin/index.js";
import {
  CreateMerchantUseCase,
  DeactivateMerchantUseCase,
  DefaultIngestKeyResolver,
  DefaultPlatformKeyResolver,
  DefaultPlatformSignatureVerifier,
  DefaultScopedMerchantService,
  GetMerchantUseCase,
  ImportMerchantsUseCase,
  type ImportMerchantsRequest,
  type ImportMerchantsResponse,
  ListMerchantsUseCase,
  RotateCredentialUseCase,
  SetKillSwitchUseCase,
  type CredentialMinter,
  type MerchantDirectory,
  type MerchantStore,
  type MessageAuthenticator,
  type RotationPolicy,
  type SignatureWindow,
} from "../../application/merchant/index.js";
import {
  memoryMerchantStore,
  nodeCredentialMinter,
  nodeMessageAuthenticator,
  makeCreateMerchant,
  makeDeactivateMerchant,
  makeGetMerchant,
  makeListMerchants,
  makeRotateIngestKey,
  makeRotatePlatformKey,
  makeRotatePlatformSecret,
  makeSetKillSwitch,
  INGEST_KEY_HEADER,
  INGEST_KEY_SCHEME,
  makeIngestKeySecurity,
  makePlatformKeySecurity,
  PLATFORM_KEY_HEADER,
  PLATFORM_KEY_SCHEME,
} from "../../interface-adapters/merchant/index.js";
import { auditedWiring } from "./audited.js";
import type { Clock, Logger, UseCase } from "../../application/shared-kernel/index.js";
import type { PlatformConfiguration } from "../../domain/configuration/index.js";
import type { Handlers, SecurityScheme } from "../../interface-adapters/http/typed.js";
import type { Bindings, Module } from "../wiring.js";

export interface MerchantPorts {
  clock: Clock;
  logger: Logger;
  /** The directory the security handlers read: served by the same instance as the store. */
  merchants: MerchantDirectory;
  merchantStore: MerchantStore;
  minter: CredentialMinter;
  rotation: RotationPolicy;
  /** The window of a platform signature (level 1 of the configuration). */
  signatureWindow: SignatureWindow;
  /** The HMAC behind the platform signature (ADR-029). */
  authenticator: MessageAuthenticator;
  adminLog: AdminLog;
}

/** The merchants in memory (one instance behind both ports), credentials and HMAC with the crypto of Node; the rotation grace and the signature window the platform declares. */
export const memoryMerchantPorts = (
  platform: PlatformConfiguration,
): Bindings<
  Pick<
    MerchantPorts,
    "merchants" | "merchantStore" | "minter" | "rotation" | "signatureWindow" | "authenticator"
  >
> => {
  let store: ReturnType<typeof memoryMerchantStore> | undefined;
  const shared = (): ReturnType<typeof memoryMerchantStore> => (store ??= memoryMerchantStore());
  return {
    merchants: shared,
    merchantStore: shared,
    minter: () => nodeCredentialMinter,
    rotation: () => ({ maxGraceMs: () => Promise.resolve(platform.rotationGraceMaxMs) }),
    signatureWindow: () => ({ windowMs: () => platform.signatureWindowMs }),
    authenticator: () => nodeMessageAuthenticator,
  };
};

/** The seed of an empty store enters through the same use case as the API, audited like one (ADR-031). */
export const importMerchantsOf = (
  ports: MerchantPorts,
): UseCase<ImportMerchantsRequest, ImportMerchantsResponse> =>
  new AuditedUseCase(
    "importMerchants",
    new ImportMerchantsUseCase({ merchants: ports.merchantStore, minter: ports.minter, clock: ports.clock }),
    { log: ports.adminLog, clock: ports.clock },
  );

/** The security schemes of the SDK and the platform (ADR-014, ADR-025, ADR-029). */
function securityOf(ports: MerchantPorts): Record<string, SecurityScheme> {
  const { clock, minter } = ports;
  const resolveIngestKey = new DefaultIngestKeyResolver({ merchants: ports.merchants, minter, clock });
  const keys = new DefaultPlatformKeyResolver({ merchants: ports.merchants, minter, clock });
  const signatures = new DefaultPlatformSignatureVerifier({
    authenticator: ports.authenticator,
    window: ports.signatureWindow,
  });
  return {
    [INGEST_KEY_SCHEME]: {
      handler: makeIngestKeySecurity(resolveIngestKey),
      header: INGEST_KEY_HEADER,
      consumer: "browser",
    },
    [PLATFORM_KEY_SCHEME]: {
      handler: makePlatformKeySecurity({ keys, signatures, clock }),
      header: PLATFORM_KEY_HEADER,
      consumer: "server",
    },
  };
}

/** The administration of merchants and credentials (ADR-031): every write audited and logged. */
function handlersOf(ports: MerchantPorts): Handlers {
  const { clock, merchantStore, minter, rotation } = ports;
  const { logged, admin } = auditedWiring(ports);
  const scoped = new DefaultScopedMerchantService({ merchants: merchantStore });
  const rotate = new RotateCredentialUseCase({ scoped, merchants: merchantStore, minter, rotation, clock });
  return {
    listMerchants: makeListMerchants(
      logged("listMerchants", new ListMerchantsUseCase({ merchants: merchantStore })),
      clock,
    ),
    createMerchant: makeCreateMerchant(
      admin("createMerchant", new CreateMerchantUseCase({ merchants: merchantStore, minter, clock }), {
        merchantId: (r) => (r.ok ? r.value.merchant.merchantId : undefined),
      }),
      clock,
    ),
    getMerchant: makeGetMerchant(logged("getMerchant", new GetMerchantUseCase({ scoped })), clock),
    deactivateMerchant: makeDeactivateMerchant(
      admin("deactivateMerchant", new DeactivateMerchantUseCase({ scoped, merchants: merchantStore })),
      clock,
    ),
    rotateIngestKey: makeRotateIngestKey(admin("rotateIngestKey", rotate)),
    rotatePlatformKey: makeRotatePlatformKey(admin("rotatePlatformKey", rotate)),
    rotatePlatformSecret: makeRotatePlatformSecret(admin("rotatePlatformSecret", rotate)),
    setKillSwitch: makeSetKillSwitch(
      admin("setKillSwitch", new SetKillSwitchUseCase({ scoped, merchants: merchantStore })),
    ),
  };
}

export const merchantModule: Module<MerchantPorts> = ({ ports }) => ({
  security: securityOf(ports),
  cors: ports.merchants,
  handlers: handlersOf(ports),
});
