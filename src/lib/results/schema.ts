import { z } from "zod";

export const scoreSchema = z.object({
  studentId: z.uuid(),
  componentId: z.uuid(),
  score: z
    .number()
    .min(0, "Scores can't be negative.")
    .max(1000)
    .refine((value) => Math.round(value * 100) / 100 === value, {
      message: "Use at most two decimal places.",
    })
    .nullable(),
});

export const saveSchema = z.object({
  classId: z.uuid(),
  subjectId: z.uuid(),
  submit: z.boolean(),
  scores: z
    .array(scoreSchema)
    .min(1, "There are no scores to save.")
    .max(6000),
});

export type ScoreInput = z.infer<typeof scoreSchema>;