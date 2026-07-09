export type CalendarLaneInput = {
  id: string;
  startTime: string | Date;
  endTime: string | Date;
};

export type CalendarLaneLayout = {
  laneIndex: number;
  totalLanes: number;
};

export type CalendarEntryDensity = "full" | "title-only" | "tiny-title";

function getMinuteOfDay(value: string | Date) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

export function getCalendarEntryLaneLayout<T extends CalendarLaneInput>(
  entries: T[],
  getKey: (entry: T) => string = (entry) => entry.id,
) {
  const sorted = [...entries].sort((left, right) => {
    const startDiff = new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
    if (startDiff !== 0) return startDiff;
    return new Date(left.endTime).getTime() - new Date(right.endTime).getTime();
  });
  const result = new Map<string, CalendarLaneLayout>();

  const flushGroup = (group: T[]) => {
    const lanes: number[] = [];
    for (const entry of group) {
      const startM = getMinuteOfDay(entry.startTime);
      const endM = Math.max(startM + 15, getMinuteOfDay(entry.endTime));
      let lane = 0;
      for (; lane < lanes.length; lane++) {
        if (lanes[lane] <= startM) break;
      }
      if (lane === lanes.length) lanes.push(0);
      lanes[lane] = endM;
      result.set(getKey(entry), { laneIndex: lane, totalLanes: 0 });
    }

    const totalLanes = Math.max(1, lanes.length);
    for (const entry of group) {
      const layout = result.get(getKey(entry));
      if (layout) layout.totalLanes = totalLanes;
    }
  };

  let group: T[] = [];
  let groupEnd = -Infinity;
  for (const entry of sorted) {
    const startM = getMinuteOfDay(entry.startTime);
    const endM = Math.max(startM + 15, getMinuteOfDay(entry.endTime));
    if (group.length > 0 && startM >= groupEnd) {
      flushGroup(group);
      group = [];
      groupEnd = -Infinity;
    }
    group.push(entry);
    groupEnd = Math.max(groupEnd, endM);
  }

  if (group.length > 0) flushGroup(group);
  return result;
}

export function getCalendarLaneStyle(entryKey: string, laneLayout: Map<string, CalendarLaneLayout>) {
  const layout = laneLayout.get(entryKey);
  if (!layout || layout.totalLanes <= 1) return { left: "2%", width: "96%" };
  const gap = 2;
  const width = (100 - gap * (layout.totalLanes + 1)) / layout.totalLanes;
  const left = gap + layout.laneIndex * (width + gap);
  return { left: `${left}%`, width: `${width}%` };
}

export function getCalendarEntryDensity(heightPx: number): CalendarEntryDensity {
  if (!Number.isFinite(heightPx) || heightPx < 32) return "tiny-title";
  if (heightPx < 56) return "title-only";
  return "full";
}

export function getCalendarResizeHandleClassName(heightPx: number) {
  const handleHeight = heightPx < 36 ? "h-1.5" : heightPx < 56 ? "h-2" : "h-3";
  return `${handleHeight} cursor-ns-resize opacity-25 transition-opacity hover:opacity-100`;
}
