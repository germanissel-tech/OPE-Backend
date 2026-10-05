// Feature 037 (FR-003, SC-003): a record declares the plain data of an entity, and a plain part is
// **not** the class — which is the whole protection. A store gives records back; the entity's
// constructor is what turns each part into its class, and a part nobody converted fails here, at
// compile time, instead of at the one write that calls its method. Verified with `npm run typecheck`
// (not executed).
import type { Merchant, MerchantRecord, Origin, OriginRecord } from "../../src/domain/merchant/index.js";
import type { Order, OrderRecord } from "../../src/domain/outcomes/index.js";
import type { Money, MoneyRecord } from "../../src/domain/shared-kernel/index.js";

declare const money: MoneyRecord;
declare const origin: OriginRecord;
declare const plainOrder: OrderRecord;
declare const plainMerchant: MerchantRecord;
declare const rehydrateOrder: (record: OrderRecord) => Order;
declare const rehydrateMerchant: (record: MerchantRecord) => Merchant;

// @ts-expect-error a plain record has the data of a Money and none of its behaviour: it is not one.
export const notMoney: Money = money;

// @ts-expect-error a plain record has the value of an Origin and no `equals`: it is not one.
export const notOrigin: Origin = origin;

// What makes the cast of a durable gateway true: a record read plain enters `rehydrate` as it is.
export const orderFromPlain: Order = rehydrateOrder(plainOrder);
export const merchantFromPlain: Merchant = rehydrateMerchant(plainMerchant);

// And the other direction, which is what keeps every caller compiling: an entity's parts are instances,
// and an instance satisfies its own record.
declare const order: Order;
export const totalAsRecord: MoneyRecord = order.total;
declare const merchant: Merchant;
export const originsAsRecords: readonly OriginRecord[] = merchant.origins;
