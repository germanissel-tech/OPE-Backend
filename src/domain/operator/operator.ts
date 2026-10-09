// Operator (ADR-020, ADR-031, ADR-044): a person of OPE who administers the platform with a token
// of their own. The token never lives here: only its fingerprints (one, or two while rotating).
// The scope says which merchants the operator may act on: every one (`*`) or a list. The display
// name is what the operator sees in the panel: never an identifier, never in the log. An
// Operator only exists valid: `of` enforces the rules, `rehydrate` trusts recorded facts.
import { fail, ok, type MerchantId, type Result } from "../shared-kernel/index.js";
import {
  InvalidOperatorDisplayName,
  InvalidOperatorScope,
  InvalidOperatorTokens,
  MerchantOutOfScope,
  OperatorScopeTooNarrow,
} from "./errors.js";
import { SYSTEM_OPERATOR, type OperatorId } from "./ids.js";

/** Every merchant, or the listed ones. */
export type OperatorScope = "*" | readonly MerchantId[];

export const EVERY_MERCHANT = "*" satisfies OperatorScope;

export interface OperatorRecord {
  operatorId: OperatorId;
  /** SHA-256 hex of each token the operator may present; at most two (a rotation). */
  tokenFingerprints: readonly string[];
  scope: OperatorScope;
  /** What the operator sees as their name; absent for an operator nobody named. */
  displayName?: string | undefined;
}

/** One token, or two during a rotation. */
const MAX_TOKENS = 2;

/** A name is for showing: short, and the same the contract publishes (`Operator.displayName`). */
export const MAX_DISPLAY_NAME = 80;

export type OperatorRule = InvalidOperatorScope | InvalidOperatorTokens | InvalidOperatorDisplayName;

export class Operator implements OperatorRecord {
  readonly operatorId: OperatorId;
  readonly tokenFingerprints: readonly string[];
  readonly scope: OperatorScope;
  readonly displayName: string | undefined;

  private constructor(record: OperatorRecord) {
    this.operatorId = record.operatorId;
    this.tokenFingerprints = [...record.tokenFingerprints];
    this.scope = record.scope === EVERY_MERCHANT ? EVERY_MERCHANT : [...record.scope];
    this.displayName = record.displayName;
  }

  /**
   * A configured operator: one or two non-empty fingerprints; a scope of `*` or merchant ids, none
   * empty; a display name, if given, that is not blank, not padded and not longer than shown.
   */
  static of(record: OperatorRecord): Result<Operator, OperatorRule> {
    const { tokenFingerprints, scope, displayName } = record;
    if (tokenFingerprints.length === 0 || tokenFingerprints.length > MAX_TOKENS) {
      return fail(new InvalidOperatorTokens());
    }
    const blank = tokenFingerprints.findIndex((f) => f.trim() === "");
    if (blank !== -1) return fail(new InvalidOperatorTokens(blank));
    if (scope !== EVERY_MERCHANT) {
      const empty = scope.findIndex((m) => String(m).trim() === "");
      if (empty !== -1) return fail(new InvalidOperatorScope(empty));
    }
    if (displayName !== undefined) {
      const trimmed = displayName.trim();
      if (trimmed === "" || trimmed !== displayName || displayName.length > MAX_DISPLAY_NAME) {
        return fail(new InvalidOperatorDisplayName());
      }
    }
    return ok(new Operator(record));
  }

  /** An operator already recorded: the facts are not re-judged. */
  static rehydrate(record: OperatorRecord): Operator {
    return new Operator(record);
  }

  /** The platform acting by itself: every merchant in scope, no token to present. */
  static system(): Operator {
    return new Operator({ operatorId: SYSTEM_OPERATOR, tokenFingerprints: [], scope: EVERY_MERCHANT });
  }

  /** Whether the operator presented this token (by fingerprint). */
  holds(fingerprint: string): boolean {
    return this.tokenFingerprints.includes(fingerprint);
  }

  /** The merchant, if the operator may act on it; otherwise the error, which never says whether it exists. */
  scopeFor(merchantId: MerchantId): Result<MerchantId, MerchantOutOfScope> {
    if (this.scope === EVERY_MERCHANT || this.scope.includes(merchantId)) return ok(merchantId);
    return fail(new MerchantOutOfScope());
  }

  /**
   * Whether this operator may act on something that reaches **every** merchant (feature 036).
   *
   * It is not `scopeFor` over a list of all of them, and the difference is not pedantic: a level of the
   * release is served to whoever does not override it, including merchants created after the change. A
   * scope that happens to name every merchant that exists today is still a list, and tomorrow it is not.
   */
  coversEveryMerchant(): Result<Operator, OperatorScopeTooNarrow> {
    return this.scope === EVERY_MERCHANT ? ok(this) : fail(new OperatorScopeTooNarrow());
  }
}
