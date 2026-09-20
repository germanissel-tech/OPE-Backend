// The admin security handler asks who presented the bearer token (ADR-023: authentication is a
// service, not a use case). Unknown, missing or malformed → OperatorUnknown, before the body.
import { OperatorUnknown, type Operator } from "../../../domain/admin/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { OperatorDirectory } from "../ports/operator-directory.js";
import type { TokenFingerprinter } from "../ports/token-fingerprinter.js";

export type AdminTokenResolution = Result<Operator, OperatorUnknown>;

export interface AdminTokenResolver {
  resolve(token: string | undefined): Promise<AdminTokenResolution>;
}

export interface AdminTokenResolverDependencies {
  operators: OperatorDirectory;
  fingerprints: TokenFingerprinter;
}

export class DefaultAdminTokenResolver implements AdminTokenResolver {
  readonly #deps: AdminTokenResolverDependencies;

  constructor(deps: AdminTokenResolverDependencies) {
    this.#deps = deps;
  }

  async resolve(token: string | undefined): Promise<AdminTokenResolution> {
    if (typeof token !== "string" || token === "") return fail(new OperatorUnknown());
    const operator = await this.#deps.operators.findByTokenFingerprint(
      await this.#deps.fingerprints.fingerprintOf(token),
    );
    return operator ? ok(operator) : fail(new OperatorUnknown());
  }
}
