// Merchant module (ADR-014, ADR-031, ADR-034): the merchants of the platform — their store and
// their administration. Who authenticates with their credentials is the access module, which
// reads the directory: this module has one reason to change, the aggregate and what an operator
// does to it. The directory is the store seen through a narrower view, so an administration
// change counts on the next request by construction and not by a closure.
import {
  CreateMerchantUseCase,
  DeactivateMerchantUseCase,
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
  type RotateCredentialRequest,
  type RotateCredentialResult,
  type RotationPolicy,
  type ScopedMerchantService,
} from "../../application/merchant/index.js";
import {
  makeCreateMerchant,
  makeDeactivateMerchant,
  makeGetMerchant,
  makeListMerchants,
  makeRotateIngestKey,
  makeRotatePlatformKey,
  makeRotatePlatformSecret,
  makeSetKillSwitch,
  memoryMerchantStore,
  nodeCredentialMinter,
} from "../../interface-adapters/merchant/index.js";
import { bind, bindAll, compositionModule, handler, port } from "../graph/index.js";
import { ClockPort, DecoratorsPort } from "./shared-kernel.js";
import type { UseCase } from "../../application/shared-kernel/index.js";

export const MerchantStorePort = port("merchant.store")<MerchantStore>();
/** The read view the access module and CORS use: the very instance of the store. */
export const MerchantDirectoryPort = port("merchant.directory")<MerchantDirectory>();
export const CredentialMinterPort = port("merchant.minter")<CredentialMinter>();
/**
 * The longest grace a rotation may give the previous credential: the rotation of the aggregate
 * consumes it and the access module, which owns the policies of that level, binds it (ADR-034).
 */
export const RotationPolicyPort = port("merchant.rotation")<RotationPolicy>();
/** How any administration reaches a merchant within the scope of its operator. */
export const ScopedMerchantsPort = port("merchant.scoped")<ScopedMerchantService>();
/** One rotation for the three credentials; each operation audits it under its own name. */
const RotateCredentialPort =
  port("merchant.rotate")<UseCase<RotateCredentialRequest, RotateCredentialResult>>();
/** The seed of an empty store enters through the same use case as the API, audited like one. */
export const ImportMerchantsPort =
  port("merchant.import")<UseCase<ImportMerchantsRequest, ImportMerchantsResponse>>();

export const merchantModule = compositionModule({
  provides: [
    // One instance, two views: what the administration writes and what the access module
    // reads. The store in memory satisfies both, so it is bound once for the two.
    bindAll([MerchantStorePort, MerchantDirectoryPort], {}, () => memoryMerchantStore()),
    bind(CredentialMinterPort, {}, () => nodeCredentialMinter),
  ],
  assembles: [
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
