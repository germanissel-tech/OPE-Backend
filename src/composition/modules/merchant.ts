// Merchant module (ADR-014, ADR-025, ADR-029, ADR-031): the merchants of the platform — their
// store, the security schemes of the SDK and the platform, and the administration of merchants
// and credentials. The directory the security handlers read is the store seen through a narrower
// view: an administration change counts on the next request, by construction and not by a closure.
import {
  CreateMerchantUseCase,
  DeactivateMerchantUseCase,
  DefaultIngestKeyResolver,
  DefaultPlatformKeyResolver,
  DefaultPlatformSignatureVerifier,
  DefaultScopedMerchantService,
  GetMerchantUseCase,
  ImportMerchantsUseCase,
  ListMerchantsUseCase,
  RotateCredentialUseCase,
  SetKillSwitchUseCase,
  type CredentialMinter,
  type ImportMerchantsRequest,
  type ImportMerchantsResponse,
  type MerchantDirectory,
  type MerchantStore,
  type MessageAuthenticator,
  type RotateCredentialRequest,
  type RotateCredentialResult,
  type RotationPolicy,
  type ScopedMerchantService,
  type SignatureWindow,
} from "../../application/merchant/index.js";
import {
  INGEST_KEY_HEADER,
  INGEST_KEY_SCHEME,
  makeCreateMerchant,
  makeDeactivateMerchant,
  makeGetMerchant,
  makeIngestKeySecurity,
  makeListMerchants,
  makePlatformKeySecurity,
  makeRotateIngestKey,
  makeRotatePlatformKey,
  makeRotatePlatformSecret,
  makeSetKillSwitch,
  memoryMerchantStore,
  nodeCredentialMinter,
  nodeMessageAuthenticator,
  PLATFORM_KEY_HEADER,
  PLATFORM_KEY_SCHEME,
  rotationPolicyOf,
  signatureWindowOf,
} from "../../interface-adapters/merchant/index.js";
import { bind, compositionModule, derive, handler, port, technology, uses } from "../graph/index.js";
import { PlatformConfigurationPort } from "../release.js";
import { ClockPort, DecoratorsPort } from "./shared-kernel.js";
import type { UseCase } from "../../application/shared-kernel/index.js";

export const MerchantStorePort = port("merchant.store")<MerchantStore>();
/** The read view the security handlers and CORS use: the very instance of the store. */
const MerchantDirectoryPort = port("merchant.directory")<MerchantDirectory>();
const CredentialMinterPort = port("merchant.minter")<CredentialMinter>();
/** The longest grace a rotation may give the previous credential (level 1 of the configuration). */
const RotationPolicyPort = port("merchant.rotation")<RotationPolicy>();
/** The window of a platform signature (level 1 of the configuration, ADR-029). */
const SignatureWindowPort = port("merchant.signature-window")<SignatureWindow>();
/** The HMAC behind the platform signature (ADR-029). */
const MessageAuthenticatorPort = port("merchant.authenticator")<MessageAuthenticator>();
/** How any administration reaches a merchant within the scope of its operator. */
export const ScopedMerchantsPort = port("merchant.scoped")<ScopedMerchantService>();
/** One rotation for the three credentials; each operation audits it under its own name. */
const RotateCredentialPort =
  port("merchant.rotate")<UseCase<RotateCredentialRequest, RotateCredentialResult>>();
/** The seed of an empty store enters through the same use case as the API, audited like one. */
export const ImportMerchantsPort =
  port("merchant.import")<UseCase<ImportMerchantsRequest, ImportMerchantsResponse>>();

/** The instance the memory technology builds: it serves both views of the merchants. */
const MemoryMerchantsPort = port("merchant.memory")<MerchantStore & MerchantDirectory>();

const PORTS = [
  MerchantStorePort,
  MerchantDirectoryPort,
  CredentialMinterPort,
  RotationPolicyPort,
  SignatureWindowPort,
  MessageAuthenticatorPort,
] as const;

export const merchantModule = compositionModule({
  ports: PORTS,
  technologies: {
    memory: technology(PORTS, [
      // One instance, two views: what the administration writes and what the security handlers
      // read. The memory store satisfies both, and both are derived from it.
      bind(MemoryMerchantsPort, {}, () => memoryMerchantStore()),
      derive(MerchantStorePort, MemoryMerchantsPort),
      derive(MerchantDirectoryPort, MemoryMerchantsPort),
      bind(CredentialMinterPort, {}, () => nodeCredentialMinter),
      bind(MessageAuthenticatorPort, {}, () => nodeMessageAuthenticator),
      bind(RotationPolicyPort, { platform: PlatformConfigurationPort }, ({ platform }) =>
        rotationPolicyOf(platform.rotationGraceMaxMs),
      ),
      bind(SignatureWindowPort, { platform: PlatformConfigurationPort }, ({ platform }) =>
        signatureWindowOf(platform.signatureWindowMs),
      ),
    ]),
  },
  exposes: [
    bind(
      ScopedMerchantsPort,
      { merchants: MerchantStorePort },
      (deps) => new DefaultScopedMerchantService(deps),
    ),
    bind(
      RotateCredentialPort,
      {
        scoped: ScopedMerchantsPort,
        merchants: MerchantStorePort,
        minter: CredentialMinterPort,
        rotation: RotationPolicyPort,
        clock: ClockPort,
      },
      (deps) => new RotateCredentialUseCase(deps),
    ),
    bind(
      ImportMerchantsPort,
      {
        deco: DecoratorsPort,
        merchants: MerchantStorePort,
        minter: CredentialMinterPort,
        clock: ClockPort,
      },
      ({ deco, ...deps }) => deco.audited("importMerchants", new ImportMerchantsUseCase(deps)),
    ),
  ],
  serves: {
    // The directory is the CORS policy: it answers whether an origin belongs to a merchant.
    cors: uses({ merchants: MerchantDirectoryPort }, ({ merchants }) => merchants),
    security: {
      [INGEST_KEY_SCHEME]: uses(
        { merchants: MerchantDirectoryPort, minter: CredentialMinterPort, clock: ClockPort },
        (deps) => ({
          handler: makeIngestKeySecurity(new DefaultIngestKeyResolver(deps)),
          header: INGEST_KEY_HEADER,
          consumer: "browser",
        }),
      ),
      [PLATFORM_KEY_SCHEME]: uses(
        {
          merchants: MerchantDirectoryPort,
          minter: CredentialMinterPort,
          clock: ClockPort,
          authenticator: MessageAuthenticatorPort,
          window: SignatureWindowPort,
        },
        ({ authenticator, window, ...keys }) => ({
          handler: makePlatformKeySecurity({
            keys: new DefaultPlatformKeyResolver(keys),
            signatures: new DefaultPlatformSignatureVerifier({ authenticator, window }),
            clock: keys.clock,
          }),
          header: PLATFORM_KEY_HEADER,
          consumer: "server",
        }),
      ),
    },
    handlers: {
      listMerchants: handler(
        { deco: DecoratorsPort, merchants: MerchantStorePort, clock: ClockPort },
        (operation, { deco, merchants, clock }) =>
          makeListMerchants(deco.logged(operation, new ListMerchantsUseCase({ merchants })), clock),
      ),
      getMerchant: handler(
        { deco: DecoratorsPort, scoped: ScopedMerchantsPort, clock: ClockPort },
        (operation, { deco, scoped, clock }) =>
          makeGetMerchant(deco.logged(operation, new GetMerchantUseCase({ scoped })), clock),
      ),
      createMerchant: handler(
        {
          deco: DecoratorsPort,
          merchants: MerchantStorePort,
          minter: CredentialMinterPort,
          clock: ClockPort,
        },
        (operation, { deco, ...deps }) =>
          makeCreateMerchant(
            deco.administered(operation, new CreateMerchantUseCase(deps), {
              merchantId: (r) => (r.ok ? r.value.merchant.merchantId : undefined),
            }),
            deps.clock,
          ),
      ),
      deactivateMerchant: handler(
        {
          deco: DecoratorsPort,
          scoped: ScopedMerchantsPort,
          merchants: MerchantStorePort,
          clock: ClockPort,
        },
        (operation, { deco, clock, ...deps }) =>
          makeDeactivateMerchant(deco.administered(operation, new DeactivateMerchantUseCase(deps)), clock),
      ),
      setKillSwitch: handler(
        { deco: DecoratorsPort, scoped: ScopedMerchantsPort, merchants: MerchantStorePort },
        (operation, { deco, ...deps }) =>
          makeSetKillSwitch(deco.administered(operation, new SetKillSwitchUseCase(deps))),
      ),
      rotateIngestKey: handler(
        { deco: DecoratorsPort, rotate: RotateCredentialPort },
        (operation, { deco, rotate }) => makeRotateIngestKey(deco.administered(operation, rotate)),
      ),
      rotatePlatformKey: handler(
        { deco: DecoratorsPort, rotate: RotateCredentialPort },
        (operation, { deco, rotate }) => makeRotatePlatformKey(deco.administered(operation, rotate)),
      ),
      rotatePlatformSecret: handler(
        { deco: DecoratorsPort, rotate: RotateCredentialPort },
        (operation, { deco, rotate }) => makeRotatePlatformSecret(deco.administered(operation, rotate)),
      ),
    },
  },
});
