import {
  AREAS,
  isArea,
  type Permissions,
} from "@/lib/auth/permissions";

/** Turns stored data into valid ticks, dropping anything unknown. */
export function cleanPermissions(raw: unknown): Permissions {
  const result: Permissions = {};

  if (raw && typeof raw === "object") {
    for (const [key, level] of Object.entries(raw as Record<string, unknown>)) {
      if (isArea(key) && (level === "view" || level === "manage")) {
        result[key] = level;
      }
    }
  }

  return result;
}

export function summarize(permissions: Permissions): string {
  const parts = AREAS.filter((area) => permissions[area.key]).map(
    (area) => `${area.label} (${permissions[area.key]})`,
  );

  return parts.length > 0 ? parts.join(", ") : "No access";
}