// The notices waiting to be read, in memory (feature 044): the local deployment's, which a restart forgets.
import { ok, type MerchantId, type NoticedFlow } from "../../../domain/shared-kernel/index.js";
import type { NoticeQueue } from "../../../application/platform/index.js";
import type { Notice } from "../../../domain/platform/index.js";

/** One notice per reference of a flow of a merchant: JSON, so no part of the key can be mistaken for another. */
const keyOf = (notice: Pick<Notice, "merchantId" | "flow" | "reference">): string =>
  JSON.stringify([notice.merchantId, notice.flow, notice.reference]);

export function memoryNoticeQueue(): NoticeQueue {
  const pending = new Map<string, Notice>();
  return {
    enqueue(notice) {
      const held = pending.get(keyOf(notice)) ?? notice;
      pending.set(keyOf(notice), held);
      return Promise.resolve(ok(held));
    },
    due: (now) =>
      Promise.resolve(
        [...pending.values()]
          .filter((notice) => notice.nextAt.getTime() <= now.getTime())
          .sort((a, b) => a.nextAt.getTime() - b.nextAt.getTime()),
      ),
    reschedule(notice) {
      pending.set(keyOf(notice), notice);
      return Promise.resolve(ok(undefined));
    },
    remove(notice) {
      pending.delete(keyOf(notice));
      return Promise.resolve(ok(undefined));
    },
    pendingOf(merchantId: MerchantId) {
      const counts: Partial<Record<NoticedFlow, number>> = {};
      for (const notice of pending.values()) {
        if (notice.merchantId === merchantId) counts[notice.flow] = (counts[notice.flow] ?? 0) + 1;
      }
      return Promise.resolve(counts);
    },
  };
}
