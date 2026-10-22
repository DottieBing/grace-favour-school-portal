export type SheetStatus = "draft" | "submitted" | "published";
export type SheetState = SheetStatus | "not_started";

export type ScoreComponent = { id: string; name: string; max: number };

export type ResultStudent = {
  id: string;
  name: string;
  admissionNumber: string;
};

export type GradeInfo = { grade: string; percent: number };

export const SHEET_STATE_LABELS: Record<SheetState, string> = {
  not_started: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  published: "Published",
};

export function scoreKey(studentId: string, componentId: string) {
  return `${studentId}:${componentId}`;
}