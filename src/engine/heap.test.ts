import { describe, it, expect } from "vitest";
import { heapPush, heapPop, heapPeek } from "./heap";

describe("heap", () => {
  const numLess = (a: number, b: number) => a < b;

  it("maintains min-heap order", () => {
    const h: number[] = [];
    heapPush(h, 5, numLess);
    heapPush(h, 3, numLess);
    heapPush(h, 8, numLess);
    heapPush(h, 1, numLess);
    heapPush(h, 4, numLess);
    expect(heapPop(h, numLess)).toBe(1);
    expect(heapPop(h, numLess)).toBe(3);
    expect(heapPop(h, numLess)).toBe(4);
    expect(heapPop(h, numLess)).toBe(5);
    expect(heapPop(h, numLess)).toBe(8);
    expect(heapPop(h, numLess)).toBeNull();
  });

  it("handles single element", () => {
    const h: number[] = [];
    heapPush(h, 42, numLess);
    expect(heapPop(h, numLess)).toBe(42);
    expect(heapPop(h, numLess)).toBeNull();
  });

  it("peek returns min without removing", () => {
    const h: number[] = [];
    heapPush(h, 10, numLess);
    heapPush(h, 3, numLess);
    expect(heapPeek(h)).toBe(3);
    expect(heapPop(h, numLess)).toBe(3);
    expect(heapPeek(h)).toBe(10);
  });

  it("returns null on empty", () => {
    expect(heapPop([], numLess)).toBeNull();
    expect(heapPeek([])).toBeNull();
  });

  it("works with objects and custom comparator", () => {
    type Item = { t: number; id: string };
    const byTime = (a: Item, b: Item) => a.t < b.t;
    const h: Item[] = [];
    heapPush(h, { t: 10, id: "a" }, byTime);
    heapPush(h, { t: 5, id: "b" }, byTime);
    heapPush(h, { t: 15, id: "c" }, byTime);
    expect(heapPop(h, byTime)!.id).toBe("b");
    expect(heapPop(h, byTime)!.id).toBe("a");
    expect(heapPop(h, byTime)!.id).toBe("c");
  });

  it("handles duplicates", () => {
    const h: number[] = [];
    heapPush(h, 2, numLess);
    heapPush(h, 2, numLess);
    heapPush(h, 2, numLess);
    expect(heapPop(h, numLess)).toBe(2);
    expect(heapPop(h, numLess)).toBe(2);
    expect(heapPop(h, numLess)).toBe(2);
    expect(heapPop(h, numLess)).toBeNull();
  });

  it("maintains heap property after many inserts", () => {
    const h: number[] = [];
    const values = [9, 3, 7, 1, 8, 2, 6, 4, 5, 0];
    for (const v of values) heapPush(h, v, numLess);
    const sorted: number[] = [];
    while (h.length) sorted.push(heapPop(h, numLess)!);
    expect(sorted).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
