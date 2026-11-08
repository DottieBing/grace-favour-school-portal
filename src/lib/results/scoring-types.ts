import type {
  GradeInfo,
  ResultStudent,
  ScoreComponent,
  SheetState,
} from "@/lib/results/types";

export type ScoringSubject = {
  id: string;
  name: string;
  sheetId: string | null;
  state: SheetState;
  locked: boolean;
  components: ScoreComponent[];
};

export type ClassScoring = {
  students: ResultStudent[];
  subjects: ScoringSubject[];
  scores: Record<string, string>;
  grades: Record<string, GradeInfo>;
};

export function sk(studentId: string, subjectId: string, componentId: string) {
  return `${studentId}:${subjectId}:${componentId}`;
}

export function gk(studentId: string, subjectId: string) {
  return `${studentId}:${subjectId}`;
}

/** How much of a class's scoring is filled in. */
export function completion(scoring: ClassScoring) {
  let filledCells = 0;
  let totalCells = 0;
  let completeStudents = 0;

  for (const student of scoring.students) {
    let missing = 0;

    for (const subject of scoring.subjects) {
      for (const component of subject.components) {
        totalCells += 1;

        if ((scoring.scores[sk(student.id, subject.id, component.id)] ?? "") !== "") {
          filledCells += 1;
        } else {
          missing += 1;
        }
      }
    }

    if (missing === 0 && scoring.subjects.length > 0) completeStudents += 1;
  }

  return {
    filledCells,
    totalCells,
    completeStudents,
    totalStudents: scoring.students.length,
  };
}