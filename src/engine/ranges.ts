export interface TimeRange {
  start: Date;
  end: Date;
}

export function mergeOverlappingRanges(ranges: TimeRange[]): TimeRange[] {
  const valid = ranges.filter((r) => r.start.getTime() < r.end.getTime());
  if (valid.length <= 1) {
    return valid.map((r) => ({ start: new Date(r.start), end: new Date(r.end) }));
  }

  const sorted = [...valid].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()
  );

  const merged: TimeRange[] = [
    { start: new Date(sorted[0].start), end: new Date(sorted[0].end) },
  ];

  for (let i = 1; i < sorted.length; i++) {
    const current = merged[merged.length - 1];
    const next = sorted[i];

    if (next.start.getTime() <= current.end.getTime()) {
      if (next.end.getTime() > current.end.getTime()) {
        current.end = new Date(next.end);
      }
    } else {
      merged.push({ start: new Date(next.start), end: new Date(next.end) });
    }
  }

  return merged;
}

export function intersect(a: TimeRange, b: TimeRange): TimeRange | null {
  const start = Math.max(a.start.getTime(), b.start.getTime());
  const end = Math.min(a.end.getTime(), b.end.getTime());

  if (start < end) {
    return { start: new Date(start), end: new Date(end) };
  }
  return null;
}

export function intersectRanges(aRanges: TimeRange[], bRanges: TimeRange[]): TimeRange[] {
  const mergedA = mergeOverlappingRanges(aRanges);
  const mergedB = mergeOverlappingRanges(bRanges);
  const intersections: TimeRange[] = [];

  for (const a of mergedA) {
    for (const b of mergedB) {
      const isect = intersect(a, b);
      if (isect) {
        intersections.push(isect);
      }
    }
  }

  return mergeOverlappingRanges(intersections);
}

export function subtract(base: TimeRange, busy: TimeRange[]): TimeRange[] {
  if (base.start.getTime() >= base.end.getTime()) {
    return [];
  }

  const mergedBusy = mergeOverlappingRanges(busy);
  const relevant = mergedBusy.filter(
    (b) => b.end.getTime() > base.start.getTime() && b.start.getTime() < base.end.getTime()
  );

  if (relevant.length === 0) {
    return [{ start: new Date(base.start), end: new Date(base.end) }];
  }

  const free: TimeRange[] = [];
  let cursor = base.start.getTime();

  for (const b of relevant) {
    const bStart = Math.max(cursor, b.start.getTime());
    const bEnd = Math.min(base.end.getTime(), b.end.getTime());

    if (bStart > cursor) {
      free.push({ start: new Date(cursor), end: new Date(bStart) });
    }
    cursor = Math.max(cursor, bEnd);
  }

  if (cursor < base.end.getTime()) {
    free.push({ start: new Date(cursor), end: new Date(base.end.getTime()) });
  }

  return free;
}

export function subtractRanges(baseRanges: TimeRange[], busy: TimeRange[]): TimeRange[] {
  const mergedBases = mergeOverlappingRanges(baseRanges);
  const mergedBusy = mergeOverlappingRanges(busy);
  const result: TimeRange[] = [];

  for (const base of mergedBases) {
    result.push(...subtract(base, mergedBusy));
  }

  return mergeOverlappingRanges(result);
}
