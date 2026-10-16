"use client";

import { useState, type ReactNode } from "react";

export type TabItem = { id: string; label: string; content: ReactNode };

export function StudentTabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" hidden={active !== tab.id}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}