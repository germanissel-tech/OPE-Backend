// In-memory anchor diagnostics (01 §3.1.1, ADR-031): the last report per merchant, anchor, page
// type and configuration version, with a counter; bounded per merchant (the oldest goes first).
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import { pageOf } from "../../shared-kernel/index.js";
import type { AnchorDiagnosticsStore } from "../../../application/admin/index.js";
import type { AnchorDiagnostic } from "../../../domain/admin/index.js";

export function memoryAnchorDiagnosticsStore(kept: number): AnchorDiagnosticsStore {
  const byMerchant = new Map<MerchantId, Map<string, AnchorDiagnostic>>();
  const keyOf = (d: Omit<AnchorDiagnostic, "count">): string =>
    JSON.stringify([d.anchor, d.pageType, d.configurationVersion]);
  return {
    upsert(diagnostic) {
      const held = byMerchant.get(diagnostic.merchantId) ?? new Map<string, AnchorDiagnostic>();
      const key = keyOf(diagnostic);
      const previous = held.get(key);
      held.delete(key);
      held.set(key, { ...diagnostic, count: (previous?.count ?? 0) + 1 });
      while (held.size > kept) {
        const oldest = held.keys().next().value;
        if (oldest === undefined) break;
        held.delete(oldest);
      }
      byMerchant.set(diagnostic.merchantId, held);
      return Promise.resolve(ok(undefined));
    },
    listOf(merchantId, query) {
      const items = [...(byMerchant.get(merchantId)?.values() ?? [])].reverse();
      return Promise.resolve(pageOf(items, query));
    },
  };
}
