import { TimeRange, mergeOverlappingRanges } from "./ranges.js";

export interface BusyInterval {
  start: Date;
  end: Date;
  beforeBuffer?: number;
  afterBuffer?: number;
}

export interface BufferConfig {
  beforeBuffer?: number;
  afterBuffer?: number;
}

export function inflateBusyIntervals(
  busyList: BusyInterval[],
  serviceBuffer: BufferConfig = {}
): TimeRange[] {
  const serviceBefore = serviceBuffer.beforeBuffer ?? 0;
  const serviceAfter = serviceBuffer.afterBuffer ?? 0;

  const inflated: TimeRange[] = busyList.map((item) => {
    const itemBefore = item.beforeBuffer ?? 0;
    const itemAfter = item.afterBuffer ?? 0;

    const effectiveBefore = Math.max(serviceBefore, itemBefore);
    const effectiveAfter = Math.max(serviceAfter, itemAfter);

    return {
      start: new Date(item.start.getTime() - effectiveBefore * 60 * 1000),
      end: new Date(item.end.getTime() + effectiveAfter * 60 * 1000),
    };
  });

  return mergeOverlappingRanges(inflated);
}
