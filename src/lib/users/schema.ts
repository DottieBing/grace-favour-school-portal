import { z } from "zod";

import { isArea } from "@/lib/auth/permissions";

export const permissionsSchema = z
  .record(z.string(), z.enum(["view", "manage"]))
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (!isArea(key)) {
        ctx.addIssue({ code: "custom", message: `Unknown area "${key}".` });
      }
    }
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Tick at least one area.",
  });

export const jobTitleSchema = z
  .string()
  .trim()
  .max(80, "The job title can be at most 80 characters.")
  .transform((value) => (value === "" ? null : value));