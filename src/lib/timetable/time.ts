export const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const DAY_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function fmtTime(value: string) {
  return value.slice(0, 5);
}

/** A period with no days listed applies to every day. */
export function appliesOn(days: number[] | null, day: number) {
  return days === null || days.length === 0 || days.includes(day);
}

export function periodsClash(
  a: { start: string; end: string; days: number[] | null },
  b: { start: string; end: string; days: number[] | null },
) {
  const sharedDay = ALL_DAYS.some(
    (day) => appliesOn(a.days, day) && appliesOn(b.days, day),
  );

  return sharedDay && a.start < b.end && b.start < a.end;
}