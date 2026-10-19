export type AttendanceStatus = "present" | "absent" | "late";

export type RegisterStudent = {
  id: string;
  name: string;
  admissionNumber: string;
};

export type Mark = { status: AttendanceStatus; note: string };

export type RegisterState = {
  id: string;
  status: "submitted" | "reopened";
  submittedAt: string;
};