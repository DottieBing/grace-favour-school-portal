export const AREAS = [
  { key: "students", label: "Students" },
  { key: "staff", label: "Staff" },
  { key: "classes", label: "Classes & subjects" },
  { key: "attendance", label: "Attendance" },
  { key: "results", label: "Results" },
  { key: "grading", label: "Grading" },
  { key: "sessions", label: "Academic sessions" },
  { key: "fees", label: "Fees" },
  { key: "timetable", label: "Timetable" },
] as const;

export type Area = (typeof AREAS)[number]["key"];
export type Level = "view" | "manage";
export type Permissions = Partial<Record<Area, Level>>;

export function isArea(value: unknown): value is Area {
  return AREAS.some((area) => area.key === value);
}

/** Manage includes view. */
export function allows(
  permissions: Permissions,
  area: Area,
  level: Level,
): boolean {
  const have = permissions[area];

  if (!have) return false;

  return level === "view" || have === "manage";
}

export function ownerPermissions(): Permissions {
  return Object.fromEntries(
    AREAS.map((area) => [area.key, "manage" as const]),
  ) as Permissions;
}