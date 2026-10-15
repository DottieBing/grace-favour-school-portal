export const LEVELS = [
  { number: 1, label: "Nursery 1" },
  { number: 2, label: "Nursery 2" },
  { number: 3, label: "Primary 1" },
  { number: 4, label: "Primary 2" },
  { number: 5, label: "Primary 3" },
  { number: 6, label: "Primary 4" },
  { number: 7, label: "Primary 5" },
  { number: 8, label: "Primary 6" },
] as const;

export function levelLabel(levelNumber: number) {
  return (
    LEVELS.find((level) => level.number === levelNumber)?.label ??
    `Level ${levelNumber}`
  );
}

/** "Primary 3" with arm "A" becomes "Primary 3A". */
export function buildClassName(levelNumber: number, section: string | null) {
  return `${levelLabel(levelNumber)}${section ?? ""}`;
}