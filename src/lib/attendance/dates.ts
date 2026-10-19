export const SCHOOL_TIME_ZONE = "Africa/Lagos";

/** Today's date (YYYY-MM-DD) in the school's time zone, not the server's. */
export function todayInSchool(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
  });
}

export function isWeekday(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}