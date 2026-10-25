"use client";

import { Button } from "@/components/ui/button";
import { AREAS, type Area, type Level, type Permissions } from "@/lib/auth/permissions";

export function PermissionGrid({
  value,
  onChange,
}: {
  value: Permissions;
  onChange: (next: Permissions) => void;
}) {
  function setLevel(area: Area, level: Level, checked: boolean) {
    const next = { ...value };

    if (level === "view") {
      if (checked) next[area] = next[area] ?? "view";
      else delete next[area];
    } else {
      // Manage includes view, and unticking it keeps view.
      next[area] = checked ? "manage" : "view";
    }

    onChange(next);
  }

  function setAll(level: Level | null) {
    onChange(
      level === null
        ? {}
        : (Object.fromEntries(AREAS.map((area) => [area.key, level])) as Permissions),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setAll("view")}>
          View everything
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAll("manage")}>
          Manage everything
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAll(null)}>
          Clear all
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="w-20 px-3 py-2 text-center font-medium">View</th>
              <th className="w-20 px-3 py-2 text-center font-medium">Manage</th>
            </tr>
          </thead>
          <tbody>
            {AREAS.map((area) => {
              const level = value[area.key];

              return (
                <tr key={area.key} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-900">{area.label}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={Boolean(level)}
                      onChange={(event) => setLevel(area.key, "view", event.target.checked)}
                      aria-label={`View ${area.label}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={level === "manage"}
                      onChange={(event) => setLevel(area.key, "manage", event.target.checked)}
                      aria-label={`Manage ${area.label}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        View lets them open and read. Manage also lets them add, edit and
        publish. Manage includes View.
      </p>
    </div>
  );
}