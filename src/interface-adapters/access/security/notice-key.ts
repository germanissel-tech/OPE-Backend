// Security handler `noticeKey` (feature 044, research R-06): the secret a platform sends with every notice
// identifies the merchant and grants nothing but `notices:write`. No signature — the platforms that notice cannot
// produce one — and no origin (there is no browser). What a notice carries does not enter OPE: what is recorded
// comes from reading the platform, so a leaked key only triggers reads.
import { CONSUMER_CAPABILITIES } from "../../http/security/capabilities.js";
import { header } from "../../http/security/headers.js";
import { SecurityError, type SecurityHandler } from "../../http/typed.js";
import type { NoticeKeyResolver } from "../../../application/access/index.js";
import type { Merchant } from "../../../domain/merchant/index.js";

export const NOTICE_KEY_SCHEME = "noticeKey";
/** The header that carries the credential; the wiring declares it so log redaction derives from it. */
export const NOTICE_KEY_HEADER = "x-ope-notice-key";

/** What the security handler leaves for the controller of the notice. */
export interface NoticePrincipal {
  merchant: Merchant;
}

export function makeNoticeKeySecurity(keys: NoticeKeyResolver): SecurityHandler {
  return async ({ headers }) => {
    const result = await keys.resolve(header(headers, NOTICE_KEY_HEADER));
    if (!result.ok) throw new SecurityError(result.error.code);
    const principal: NoticePrincipal = { merchant: result.value };
    return {
      principal,
      capabilities: CONSUMER_CAPABILITIES.notifier,
      log: { merchantId: result.value.merchantId },
    };
  };
}
