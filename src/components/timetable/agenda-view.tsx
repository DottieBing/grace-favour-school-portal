import { DAY_NAMES } from "@/lib/timetable/time";
import type { AgendaItem } from "@/lib/timetable/types";

export function AgendaView({
  days,
  items,
  emptyText = "Nothing scheduled.",
}: {
  days: number[];
  items: AgendaItem[];
  emptyText?: string;
}) {
  const hasLessons = items.some((item) => !item.isBreak);

  if (!hasLessons) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => {
        const list = items
          .filter((item) => item.day === day)
          .sort((a, b) => a.start.localeCompare(b.start));

        return (
          <section key={day} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">{DAY_NAMES[day]}</h3>

            {list.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Nothing scheduled.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {list.map((item, index) => (
                  <li
                    key={`${item.start}-${index}`}
                    className={`flex gap-3 rounded-lg p-2.5 text-sm ${
                      item.isBreak ? "bg-slate-50 text-slate-500" : "border border-slate-200"
                    }`}
                  >
                    <span className="w-24 shrink-0 font-mono text-xs text-slate-500">
                      {item.start} to {item.end}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-900">{item.title}</span>
                      {item.subtitle ? (
                        <span className="block text-xs text-slate-500">{item.subtitle}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}