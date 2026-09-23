// outcomes module (ADR-028): what the platform and the SDK say about purchases — orders, returns
// and corroborations. The correlation asks the decision ledger what it knows of a session.
import {
  CorroborateOrderUseCase,
  NotifyOrderUseCase,
  NotifyReturnUseCase,
  type CorroborationLedger,
  type OrderLedger,
} from "../../application/outcomes/index.js";
import {
  makeCorroborateOrder,
  makeNotifyOrder,
  makeNotifyReturn,
  memoryCorroborationLedger,
  memoryOrderLedger,
} from "../../interface-adapters/outcomes/index.js";
import { bind, compositionModule, served, port } from "../graph/index.js";
import { DecisionLedgerPort } from "./ledger.js";
import { ClockPort, ClockTolerancePort, LoggerPort } from "./shared-kernel.js";

export const OrderLedgerPort = port("outcomes.orders")<OrderLedger>();
export const CorroborationLedgerPort = port("outcomes.corroborations")<CorroborationLedger>();

export const outcomesModule = compositionModule({
  provides: [
    bind(OrderLedgerPort, {}, () => memoryOrderLedger()),
    bind(CorroborationLedgerPort, {}, () => memoryCorroborationLedger()),
  ],
  serves: {
    handlers: {
      notifyOrder: served(
        {
          clock: ClockPort,
          tolerance: ClockTolerancePort,
          logger: LoggerPort,
          orders: OrderLedgerPort,
          decisions: DecisionLedgerPort,
          corroborations: CorroborationLedgerPort,
        },
        { name: "notifyOrder", build: (deps) => new NotifyOrderUseCase(deps) },
        (useCase) => makeNotifyOrder(useCase),
      ),
      corroborateOrder: served(
        {
          clock: ClockPort,
          tolerance: ClockTolerancePort,
          corroborations: CorroborationLedgerPort,
        },
        { name: "corroborateOrder", build: (deps) => new CorroborateOrderUseCase(deps) },
        (useCase) => makeCorroborateOrder(useCase),
      ),
      notifyReturn: served(
        { clock: ClockPort, orders: OrderLedgerPort },
        { name: "notifyReturn", build: (deps) => new NotifyReturnUseCase(deps) },
        (useCase) => makeNotifyReturn(useCase),
      ),
    },
  },
});
