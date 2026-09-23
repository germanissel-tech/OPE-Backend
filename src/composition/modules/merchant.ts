// Merchant module (ADR-014, ADR-031, ADR-034): the merchants of the platform — their store and
// their administration. Who authenticates with their credentials is the access module, which
// reads the directory: this module has one reason to change, the aggregate and what an operator
// does to it. The directory is the store seen through a narrower view, so an administration
// change counts on the next request by construction and not by a closure.
import {
  CreateMerchantUseCase,
  DeactivateMerchantUseCase,
  ScopedMerchants,
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
import { bind, bindAll, compositionModule, served, port } from "../graph/index.js";
import { AuditPort, ClockPort } from "./shared-kernel.js";
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
export const ScopedMerchantPort = port("merchant.scoped")<ScopedMerchantService>();
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
    bind(ScopedMerchantPort, { merchants: MerchantStorePort }, (deps) => new ScopedMerchants(deps)),
    bind(
      RotateCredentialPort,
      {
        scoped: ScopedMerchantPort,
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
        audit: AuditPort,
        merchants: MerchantStorePort,
        minter: CredentialMinterPort,
        clock: ClockPort,
      },
      ({ audit, ...deps }) => audit("importMerchants", new ImportMerchantsUseCase(deps)),
    ),
  ],
  serves: {
    handlers: {
      listMerchants: served(
        { merchants: MerchantStorePort, clock: ClockPort },
        { name: "listMerchants", build: ({ merchants }) => new ListMerchantsUseCase({ merchants }) },
        (useCase, { clock }) => makeListMerchants(useCase, clock),
      ),
      getMerchant: served(
        { scoped: ScopedMerchantPort, clock: ClockPort },
        { name: "getMerchant", build: ({ scoped }) => new GetMerchantUseCase({ scoped }) },
        (useCase, { clock }) => makeGetMerchant(useCase, clock),
      ),
      createMerchant: served(
        {
          merchants: MerchantStorePort,
          minter: CredentialMinterPort,
          clock: ClockPort,
        },
        { name: "createMerchant", build: (deps) => new CreateMerchantUseCase(deps) },
        (useCase, { clock }) => makeCreateMerchant(useCase, clock),
        { merchantId: (r) => (r.ok ? r.value.merchant.merchantId : undefined) },
      ),
      deactivateMerchant: served(
        {
          scoped: ScopedMerchantPort,
          merchants: MerchantStorePort,
          clock: ClockPort,
        },
        { name: "deactivateMerchant", build: (deps) => new DeactivateMerchantUseCase(deps) },
        (useCase, { clock }) => makeDeactivateMerchant(useCase, clock),
      ),
      setKillSwitch: served(
        { scoped: ScopedMerchantPort, merchants: MerchantStorePort },
        { name: "setKillSwitch", build: (deps) => new SetKillSwitchUseCase(deps) },
        (useCase) => makeSetKillSwitch(useCase),
      ),
      rotateIngestKey: served(
        { rotate: RotateCredentialPort },
        // The three rotations share one use case; each audits it under its own operation.
        { name: "rotateIngestKey", build: ({ rotate }) => rotate },
        (useCase) => makeRotateIngestKey(useCase),
      ),
      rotatePlatformKey: served(
        { rotate: RotateCredentialPort },
        // The three rotations share one use case; each audits it under its own operation.
        { name: "rotatePlatformKey", build: ({ rotate }) => rotate },
        (useCase) => makeRotatePlatformKey(useCase),
      ),
      rotatePlatformSecret: served(
        { rotate: RotateCredentialPort },
        // The three rotations share one use case; each audits it under its own operation.
        { name: "rotatePlatformSecret", build: ({ rotate }) => rotate },
        (useCase) => makeRotatePlatformSecret(useCase),
      ),
    },
  },
});
