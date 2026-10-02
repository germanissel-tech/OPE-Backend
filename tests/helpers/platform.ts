// The values of the platform and of the treatment defaults as the unit tests receive them
// (feature 017, constitution XI): what the release declares, read once through the same
// readers the composition uses, served through the ports the consumers declare.
import { testLevels } from "./test-app.js";
import type { SignatureWindow } from "../../src/application/access/index.js";
import type { CatalogPolicies } from "../../src/application/catalog/index.js";
import type { VisitorWindow } from "../../src/application/decision/index.js";
import type { ClockTolerance } from "../../src/application/shared-kernel/index.js";
import type { ConfigurationVersions } from "../../src/domain/shared-kernel/index.js";

export const TEST_TOLERANCE: ClockTolerance = {
  skewMs: () => testLevels().platform.clockSkewToleranceMs,
  eventPastMs: () => testLevels().platform.eventPastToleranceMs,
};

export const TEST_SIGNATURE_WINDOW: SignatureWindow = {
  windowMs: () => testLevels().platform.signatureWindowMs,
};

export const testVisitorWindow = (): VisitorWindow => ({
  ttlMs: testLevels().platform.visitorWindowMs,
  maxVisitors: testLevels().platform.dedupWindow.maxIds,
});

/** Every merchant gets the defaults: what the tests of the catalogue and the decision plane assume. */
export const TEST_CATALOG_POLICIES: CatalogPolicies = {
  freshnessFor: () => Promise.resolve(testLevels().defaults.values.freshness),
  syncLevelRulesFor: () => Promise.resolve(testLevels().defaults.values.syncLevel),
};

/**
 * The versions a decision stamps when the merchant published none, **in a test that does not boot**: the
 * name the content of each release file travels under (`levels-config.ts`).
 *
 * A test that boots the server is served the version in force of each level, which the store numbers from
 * one (`platform-1`) — the two names differ on purpose, and which one a test sees says whether it went
 * through the store or straight to the file.
 */
export const TEST_VERSIONS: ConfigurationVersions = { platform: "platform-seed", defaults: "defaults-seed" };
