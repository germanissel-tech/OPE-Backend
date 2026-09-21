// outcomes module (ADR-028): what the platform and the SDK push about purchases — orders,
// returns and corroborations. What it needs (`OutcomesPorts`), how memory serves it
// (`memoryOutcomesPorts`) and what it serves (`notifyOrder`, `corroborateOrder`,
// `notifyReturn`) live together.
import {
  CorroborateOrderUseCase,
  NotifyOrderUseCase,
  NotifyReturnUseCase,
  type CorroborationLedger,
  type OrderLedger,
} from "../../application/outcomes/index.js";
import {
  LoggedUseCase,
  type Clock,
  type ClockTolerance,
  type Logger,
} from "../../application/shared-kernel/index.js";
import { memoryCorroborationLedger } from "../../interface-adapters/gateways/outcomes/memory-corroboration-ledger.js";
import { memoryOrderLedger } from "../../interface-adapters/gateways/outcomes/memory-order-ledger.js";
import { makeCorroborateOrder } from "../../interface-adapters/http/controllers/outcomes/corroborate-order.js";
import { makeNotifyOrder } from "../../interface-adapters/http/controllers/outcomes/notify-order.js";
import { makeNotifyReturn } from "../../interface-adapters/http/controllers/outcomes/notify-return.js";
import type { DecisionLedger } from "../../application/ledger/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface OutcomesPorts {
  clock: Clock;
  logger: Logger;
  tolerance: ClockTolerance;
  orders: OrderLedger;
  corroborations: CorroborationLedger;
  /** The decision ledger answers what it knows of a session: the correlation needs it. */
  decisions: DecisionLedger;
}

export const memoryOutcomesPorts: Bindings<Pick<OutcomesPorts, "orders" | "corroborations">> = {
  orders: memoryOrderLedger,
  corroborations: memoryCorroborationLedger,
};

export const outcomesModule: Module<OutcomesPorts> = ({ ports }) => {
  const { clock, tolerance, logger, orders, corroborations, decisions } = ports;
  const logged = { clock, logger };
  const notifyOrder = new LoggedUseCase(
    "notifyOrder",
    new NotifyOrderUseCase({ clock, tolerance, orders, decisions, corroborations, logger }),
    logged,
  );
  const corroborateOrder = new LoggedUseCase(
    "corroborateOrder",
    new CorroborateOrderUseCase({ clock, tolerance, corroborations }),
    logged,
  );
  const notifyReturn = new LoggedUseCase("notifyReturn", new NotifyReturnUseCase({ clock, orders }), logged);
  return {
    handlers: {
      notifyOrder: makeNotifyOrder(notifyOrder),
      corroborateOrder: makeCorroborateOrder(corroborateOrder),
      notifyReturn: makeNotifyReturn(notifyReturn),
    },
  };
};
