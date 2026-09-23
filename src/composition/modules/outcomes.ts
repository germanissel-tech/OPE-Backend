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
import { bind, compositionModule, handler, port } from "../graph/index.js";
import { DecisionLedgerPort } from "./ledger.js";
import { ClockPort, ClockTolerancePort, DecoratorsPort, LoggerPort } from "./shared-kernel.js";

export const OrderLedgerPort = port("outcomes.orders")<OrderLedger>();
export const CorroborationLedgerPort = port("outcomes.corroborations")<CorroborationLedger>();

export const outcomesModule = compositionModule({
  provides: [
    bind(OrderLedgerPort, {}, () => memoryOrderLedger()),
    bind(CorroborationLedgerPort, {}, () => memoryCorroborationLedger()),
  ],
  serves: {
    handlers: {
      notifyOrder: handler(
        {
          deco: DecoratorsPort,
          clock: ClockPort,
          tolerance: ClockTolerancePort,
          logger: LoggerPort,
          orders: OrderLedgerPort,
          decisions: DecisionLedgerPort,
          corroborations: CorroborationLedgerPort,
        },
        (operation, { deco, ...deps }) =>
          makeNotifyOrder(deco.logged(operation, new NotifyOrderUseCase(deps))),
      ),
      corroborateOrder: handler(
        {
          deco: DecoratorsPort,
          clock: ClockPort,
          tolerance: ClockTolerancePort,
          corroborations: CorroborationLedgerPort,
        },
        (operation, { deco, ...deps }) =>
          makeCorroborateOrder(deco.logged(operation, new CorroborateOrderUseCase(deps))),
      ),
      notifyReturn: handler(
        { deco: DecoratorsPort, clock: ClockPort, orders: OrderLedgerPort },
        (operation, { deco, ...deps }) =>
          makeNotifyReturn(deco.logged(operation, new NotifyReturnUseCase(deps))),
      ),
    },
  },
});
