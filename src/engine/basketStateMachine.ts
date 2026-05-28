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
  | { type: "RESTART" }
  | { type: "FAIL" };

export const basketMachine = createMachine(
  {
    id: "basket",
    initial: "WAITING_LOAD" as BasketState,
    states: {
      WAITING_LOAD: { on: { START_LOAD: "LOADING", FAIL: "FAILED" } },
      LOADING: { on: { FINISH_LOAD: "READY_FOR_PICKUP", FAIL: "FAILED" } },
      READY_FOR_PICKUP: { on: { PICKUP: "IN_TRANSIT", FAIL: "FAILED" } },
      IN_TANK: { on: { DWELL_COMPLETE: "READY_FOR_PICKUP", PICKUP: "IN_TRANSIT", FAIL: "FAILED" } },
      IN_TRANSIT: { on: { DROP_AT_TANK: "IN_TANK", DROP_FOR_UNLOAD: "WAITING_UNLOAD", FAIL: "FAILED" } },
      WAITING_UNLOAD: { on: { START_UNLOAD: "UNLOADING", FAIL: "FAILED" } },
      UNLOADING: { on: { FINISH_UNLOAD: "DONE", FAIL: "FAILED" } },
      DONE: { on: { RESTART: "WAITING_LOAD", FAIL: "FAILED" } },
      FAILED: { on: {} },
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
