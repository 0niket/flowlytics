import { describe, it, expect } from "vitest";
import { basketMachine, transitionBasketWithLog } from "./basketStateMachine";
import type { Basket, BasketState } from "../types";

describe("basketMachine", () => {
  it("has WAITING_LOAD as initial state", () => {
    const s = basketMachine.initialState;
    expect(s.value).toBe("WAITING_LOAD");
  });

  it("transitions WAITING_LOAD → LOADING on START_LOAD", () => {
    const s = basketMachine.transition("WAITING_LOAD", "START_LOAD");
    expect(s.value).toBe("LOADING");
  });

  it("transitions LOADING → READY_FOR_PICKUP on FINISH_LOAD", () => {
    const s = basketMachine.transition("LOADING", "FINISH_LOAD");
    expect(s.value).toBe("READY_FOR_PICKUP");
  });

  it("transitions READY_FOR_PICKUP → IN_TRANSIT on PICKUP", () => {
    const s = basketMachine.transition("READY_FOR_PICKUP", "PICKUP");
    expect(s.value).toBe("IN_TRANSIT");
  });

  it("transitions IN_TANK → READY_FOR_PICKUP on DWELL_COMPLETE", () => {
    const s = basketMachine.transition("IN_TANK", "DWELL_COMPLETE");
    expect(s.value).toBe("READY_FOR_PICKUP");
  });

  it("transitions IN_TANK → IN_TRANSIT on PICKUP (wagon arrives early)", () => {
    const s = basketMachine.transition("IN_TANK", "PICKUP");
    expect(s.value).toBe("IN_TRANSIT");
  });

  it("transitions IN_TRANSIT → IN_TANK on DROP_AT_TANK", () => {
    const s = basketMachine.transition("IN_TRANSIT", "DROP_AT_TANK");
    expect(s.value).toBe("IN_TANK");
  });

  it("transitions IN_TRANSIT → WAITING_UNLOAD on DROP_FOR_UNLOAD", () => {
    const s = basketMachine.transition("IN_TRANSIT", "DROP_FOR_UNLOAD");
    expect(s.value).toBe("WAITING_UNLOAD");
  });

  it("transitions WAITING_UNLOAD → UNLOADING on START_UNLOAD", () => {
    const s = basketMachine.transition("WAITING_UNLOAD", "START_UNLOAD");
    expect(s.value).toBe("UNLOADING");
  });

  it("transitions UNLOADING → DONE on FINISH_UNLOAD", () => {
    const s = basketMachine.transition("UNLOADING", "FINISH_UNLOAD");
    expect(s.value).toBe("DONE");
  });

  it("full lifecycle: WAITING_LOAD → ... → DONE (8 transitions)", () => {
    const steps: [BasketState, string, string][] = [
      ["WAITING_LOAD", "START_LOAD", "LOADING"],
      ["LOADING", "FINISH_LOAD", "READY_FOR_PICKUP"],
      ["READY_FOR_PICKUP", "PICKUP", "IN_TRANSIT"],
      ["IN_TRANSIT", "DROP_AT_TANK", "IN_TANK"],
      ["IN_TANK", "DWELL_COMPLETE", "READY_FOR_PICKUP"],
      ["READY_FOR_PICKUP", "PICKUP", "IN_TRANSIT"],
      ["IN_TRANSIT", "DROP_FOR_UNLOAD", "WAITING_UNLOAD"],
      ["WAITING_UNLOAD", "START_UNLOAD", "UNLOADING"],
      ["UNLOADING", "FINISH_UNLOAD", "DONE"],
    ];
    let current: BasketState = "WAITING_LOAD";
    for (const [from, event, to] of steps) {
      expect(current).toBe(from);
      const s = basketMachine.transition(current, event);
      current = s.value as BasketState;
      expect(current).toBe(to);
    }
  });
});

describe("transitionBasketWithLog", () => {
  it("transitions state and records stateHistory entry", () => {
    const basket: Basket = {
      id: "B1", createdAt: 0, cycleCount: 0, currentState: "WAITING_LOAD", stateEnteredAt: 0, elapsedInState: 0,
      loc: "LOAD", insertedAt: null, readyAt: null, doneAt: null,
      totalWaitSec: 0, totalTravelSec: 0, totalDwellSec: 0,
    };
    transitionBasketWithLog(basket, "START_LOAD", 10.5, "loading_started");
    expect(basket.currentState).toBe("LOADING");
    expect(basket.stateHistory).toHaveLength(1);
    expect(basket.stateHistory![0]).toEqual({
      timestamp: 10.5, fromState: "WAITING_LOAD", toState: "LOADING", reason: "loading_started",
    });
  });

  it("accumulates multiple transitions in stateHistory", () => {
    const basket: Basket = {
      id: "B1", createdAt: 0, cycleCount: 0, currentState: "WAITING_LOAD", stateEnteredAt: 0, elapsedInState: 0,
      loc: "LOAD", insertedAt: null, readyAt: null, doneAt: null,
      totalWaitSec: 0, totalTravelSec: 0, totalDwellSec: 0,
    };
    transitionBasketWithLog(basket, "START_LOAD", 10, "loading_started");
    transitionBasketWithLog(basket, "FINISH_LOAD", 30, "load_complete");
    expect(basket.stateHistory).toHaveLength(2);
    expect(basket.stateHistory![1]).toEqual({
      timestamp: 30, fromState: "LOADING", toState: "READY_FOR_PICKUP", reason: "load_complete",
    });
  });

  it("transitions DONE → WAITING_LOAD on RESTART (cycle)", () => {
    const s = basketMachine.transition("DONE", "RESTART");
    expect(s.value).toBe("WAITING_LOAD");
  });

  it("full multi-cycle lifecycle via RESTART", () => {
    const basket: Basket = {
      id: "B1", createdAt: 0, cycleCount: 0, currentState: "WAITING_LOAD", stateEnteredAt: 0, elapsedInState: 0,
      loc: "LOAD", insertedAt: null, readyAt: null, doneAt: null,
      totalWaitSec: 0, totalTravelSec: 0, totalDwellSec: 0,
    };
    transitionBasketWithLog(basket, "START_LOAD", 10, "loading_started");
    transitionBasketWithLog(basket, "FINISH_LOAD", 30, "load_complete");
    transitionBasketWithLog(basket, "PICKUP", 35, "picked_up");
    transitionBasketWithLog(basket, "DROP_AT_TANK", 40, "dropped");
    transitionBasketWithLog(basket, "DWELL_COMPLETE", 50, "dwell_done");
    transitionBasketWithLog(basket, "PICKUP", 55, "picked_up");
    transitionBasketWithLog(basket, "DROP_FOR_UNLOAD", 60, "dropped_unload");
    transitionBasketWithLog(basket, "START_UNLOAD", 65, "unloading");
    transitionBasketWithLog(basket, "FINISH_UNLOAD", 70, "unload_complete");
    transitionBasketWithLog(basket, "RESTART", 75, "cycle_restart");
    expect(basket.currentState).toBe("WAITING_LOAD");
    expect(basket.stateHistory).toHaveLength(10);
    expect(basket.stateHistory![9]).toEqual({
      timestamp: 75, fromState: "DONE", toState: "WAITING_LOAD", reason: "cycle_restart",
    });
  });
});
