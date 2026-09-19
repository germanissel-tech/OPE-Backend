// Public API of the outcomes module (application): the use cases the platform and the SDK
// reach, and the ports the ledgers implement.
export type { CorroborationLedger, CorroborationRecordStatus } from "./ports/corroboration-ledger.js";
export type { OrderLedger, OrderRecording, ReturnRecording } from "./ports/order-ledger.js";
export { NotifyOrderUseCase } from "./use-cases/notify-order.use-case.js";
export type {
  NotifyOrderDependencies,
  NotifyOrderRequest,
  NotifyOrderResponse,
  OrderNotified,
} from "./use-cases/notify-order.use-case.js";
export { CorroborateOrderUseCase } from "./use-cases/corroborate-order.use-case.js";
export type {
  CorroborateOrderDependencies,
  CorroborateOrderRequest,
  CorroborateOrderResponse,
  OrderCorroborated,
} from "./use-cases/corroborate-order.use-case.js";
export { NotifyReturnUseCase } from "./use-cases/notify-return.use-case.js";
export type {
  NotifyReturnDependencies,
  NotifyReturnRequest,
  NotifyReturnResponse,
  ReturnNotified,
} from "./use-cases/notify-return.use-case.js";
