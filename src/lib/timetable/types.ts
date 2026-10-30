export type PeriodInfo = {
  id: string;
  name: string;
  start: string;
  end: string;
  isBreak: boolean;
  days: number[] | null;
};

export type Cell = {
  subjectId: string | null;
  label: string;
  teacherId: string | null;
  room: string;
};

export type SubjectOption = { id: string; name: string; teacherId: string | null };
export type PersonOption = { id: string; name: string };

export type AgendaItem = {
  day: number;
  start: string;
  end: string;
  title: string;
  subtitle?: string;
  isBreak?: boolean;
};

export function cellKey(periodId: string, day: number) {
  return `${periodId}:${day}`;
}