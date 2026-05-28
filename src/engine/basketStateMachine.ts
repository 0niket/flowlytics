import { createMachine } from "@xstate/fsm";
import type { BasketState, BasketStateTransition } from "../types";

type BasketEvent =
  | { type: "START_LOAD" }
  | { type: "FINISH_LOAD" }
  | { type: "PICKUP" }
  | { type: "DROP_AT_TANK" }
  | { type: "DWELL_COMPLETE" }
  | { type: "DROP_FOR_UNLOAD" }
  | { type: "START_UNLOAD" }
  | { type: "FINISH_UNLOAD" }
  | { type: "RESTART" };

export const basketMachine = createMachine(
  {
    id: "basket",
    initial: "WAITING_LOAD" as BasketState,
    states: {
      WAITING_LOAD: { on: { START_LOAD: "LOADING" } },
      LOADING: { on: { FINISH_LOAD: "READY_FOR_PICKUP" } },
      READY_FOR_PICKUP: { on: { PICKUP: "IN_TRANSIT" } },
      IN_TANK: { on: { DWELL_COMPLETE: "READY_FOR_PICKUP", PICKUP: "IN_TRANSIT" } },
      IN_TRANSIT: { on: { DROP_AT_TANK: "IN_TANK", DROP_FOR_UNLOAD: "WAITING_UNLOAD" } },
      WAITING_UNLOAD: { on: { START_UNLOAD: "UNLOADING" } },
      UNLOADING: { on: { FINISH_UNLOAD: "DONE" } },
      DONE: { on: { RESTART: "WAITING_LOAD" } },
    },
  },
);

export function transitionBasket(
  current: BasketState,
  event: BasketEvent["type"],
): BasketState {
  const s = basketMachine.transition(current, event);
  return s.value as BasketState;
}

export function transitionBasketWithLog(
  basket: { currentState: BasketState; stateHistory?: BasketStateTransition[] },
  event: BasketEvent["type"],
  timestamp: number,
  reason: string,
): void {
  const fromState = basket.currentState;
  const nextState = basketMachine.transition(fromState, event);
  const toState = nextState.value as BasketState;
  basket.currentState = toState;
  if (!basket.stateHistory) basket.stateHistory = [];
  basket.stateHistory.push({ timestamp, fromState, toState, reason });
}
