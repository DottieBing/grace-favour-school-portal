import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { duplicateKey } from "@/lib/students/import-schema";

type Admin = ReturnType<typeof createAdminClient>;

type Person = { firstName: string; lastName: string; dateOfBirth: string };

function variants(name: string) {
  const lower = name.toLowerCase();

  return [
    name,
    lower,
    name.toUpperCase(),
    lower.charAt(0).toUpperCase() + lower.slice(1),
  ];
}

/**
 * Finds students who already exist with the same name and date of birth.
 * Returns null if the lookup fails, so callers never import blindly.
 */
export async function findExistingKeys(
  admin: Admin,
  people: Person[],
): Promise<Set<string> | null> {
  const found = new Set<string>();

  for (let start = 0; start < people.length; start += 25) {
    const chunk = people.slice(start, start + 25);

    const lastNames = [...new Set(chunk.flatMap((item) => variants(item.lastName)))];
    const dates = [...new Set(chunk.map((item) => item.dateOfBirth))];

    const { data, error } = await admin
      .from("students")
      .select("first_name, last_name, date_of_birth")
      .in("last_name", lastNames)
      .in("date_of_birth", dates);

    if (error) {
      console.error("Unable to check existing students:", error.message);
      return null;
    }

    for (const row of data ?? []) {
      found.add(
        duplicateKey({
          firstName: row.first_name as string,
          lastName: row.last_name as string,
          dateOfBirth: row.date_of_birth as string,
        }),
      );
    }
  }

  return found;
}