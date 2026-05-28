export function heapPush<T>(heap: T[], item: T, less: (a: T, b: T) => boolean): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const p = Math.floor((i - 1) / 2);
    if (!less(heap[i], heap[p])) break;
    [heap[i], heap[p]] = [heap[p], heap[i]];
    i = p;
  }
}

export function heapPop<T>(heap: T[], less: (a: T, b: T) => boolean): T | null {
  if (!heap.length) return null;
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    while (true) {
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      let m = i;
      if (l < heap.length && less(heap[l], heap[m])) m = l;
      if (r < heap.length && less(heap[r], heap[m])) m = r;
      if (m === i) break;
      [heap[i], heap[m]] = [heap[m], heap[i]];
      i = m;
    }
  }
  return top;
}

export function heapPeek<T>(heap: T[]): T | null {
  return heap.length ? heap[0] : null;
}
