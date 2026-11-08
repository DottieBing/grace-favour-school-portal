import { z } from "zod";

export const scoreValue = z
  .number()
  .min(0, "Scores can't be negative.")
  .max(1000)
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "Use at most two decimal places.",
  });