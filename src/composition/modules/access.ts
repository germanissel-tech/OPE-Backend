// access module (ADR-034): who enters and with what. The three security schemes the contract
// declares, the four resolvers behind them and the policies of the platform level that
// authentication depends on — the window of a signature and the longest grace a rotation may give.
//
// It reads the merchants through the directory and never writes to them: that direction is the
// invariant that keeps the module of merchants with a single reason to change. The port of the
// rotation grace is declared by merchants, which consumes it to administer its aggregate, and
// bound here, which is where the policy belongs.
import {
  DefaultAdminTokenResolver,
  DefaultIngestKeyResolver,
  DefaultPlatformKeyResolver,
  DefaultPlatformSignatureVerifier,
  type MessageAuthenticator,
  type OperatorDirectory,
  type SignatureWindow,
  type TokenFingerprinter,
} from "../../application/access/index.js";
import {
  ADMIN_TOKEN_HEADER,
  ADMIN_TOKEN_SCHEME,
  configOperatorDirectory,
  INGEST_KEY_HEADER,
  INGEST_KEY_SCHEME,
  makeAdminTokenSecurity,
  makeIngestKeySecurity,
  makePlatformKeySecurity,
  nodeMessageAuthenticator,
  nodeTokenFingerprinter,
  PLATFORM_KEY_HEADER,
  PLATFORM_KEY_SCHEME,
  rotationPolicyOf,
  signatureWindowOf,
} from "../../interface-adapters/access/index.js";
import { bind, compositionModule, port, uses } from "../graph/index.js";
import { OperatorsPort, PlatformConfigurationPort } from "../release.js";
import { CredentialMinterPort, MerchantDirectoryPort, RotationPolicyPort } from "./merchant.js";
import { ClockPort } from "./shared-kernel.js";

/** The HMAC behind the platform signature (ADR-029). */
const MessageAuthenticatorPort = port("access.authenticator")<MessageAuthenticator>();
/** How far the timestamp of a signature may sit from the clock (level 1 of the configuration). */
const SignatureWindowPort = port("access.signature-window")<SignatureWindow>();
/** The operators of the platform and their tokens. */
const OperatorDirectoryPort = port("access.operators")<OperatorDirectory>();
const TokenFingerprinterPort = port("access.fingerprints")<TokenFingerprinter>();

export const accessModule = compositionModule({
  provides: [
    bind(MessageAuthenticatorPort, {}, () => nodeMessageAuthenticator),
    bind(TokenFingerprinterPort, {}, () => nodeTokenFingerprinter),
    bind(OperatorDirectoryPort, { operators: OperatorsPort }, ({ operators }) =>
      configOperatorDirectory(operators),
    ),
    bind(SignatureWindowPort, { platform: PlatformConfigurationPort }, ({ platform }) =>
      signatureWindowOf(platform.signatureWindowMs),
    ),
    bind(RotationPolicyPort, { platform: PlatformConfigurationPort }, ({ platform }) =>
      rotationPolicyOf(platform.rotationGraceMaxMs),
    ),
  ],
  serves: {
    // Which origins may reach a merchant from a page is also a question of access: the directory
    // answers it, and CORS derives the headers of the browser schemes from what is wired here.
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
      [ADMIN_TOKEN_SCHEME]: uses(
        { operators: OperatorDirectoryPort, fingerprints: TokenFingerprinterPort },
        (deps) => ({
          handler: makeAdminTokenSecurity(new DefaultAdminTokenResolver(deps)),
          header: ADMIN_TOKEN_HEADER,
          consumer: "server",
        }),
      ),
    },
  },
});
