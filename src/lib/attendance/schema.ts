import { z } from "zod";

export const recordSchema = z.object({
  studentId: z.uuid(),
  status: z.enum(["present", "absent", "late"]),
  note: z.string().trim().max(200, "Notes can be at most 200 characters."),
});

export const recordsSchema = z
  .array(recordSchema)
  .min(1, "There are no students to mark.")
  .max(100);

export type RecordInput = z.infer<typeof recordSchema>;