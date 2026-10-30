export type DashboardData = {
  students: { total: number; newThisSession: number | null };
  staff: { teaching: number; nonTeaching: number };
  attendanceToday: { percent: number | null; submitted: number; expected: number };
  results: { published: number; submitted: number; total: number };
  fees: { collected: number; outstanding: number; reviewing: number };
  weekly: { day: string; present: number | null; absent: number | null }[];
  weeklyAverage: number | null;
  byClass: { name: string; students: number; capacity: number | null }[];
  bySession: { name: string; students: number }[];
  pending: { results: number; attendance: number; payments: number };
};

export type DashboardVisibility = {
  students: boolean;
  staff: boolean;
  attendance: boolean;
  results: boolean;
  classes: boolean;
  sessions: boolean;
  fees: boolean;
  addStudents: boolean;
};