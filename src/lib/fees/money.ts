import { z } from "zod";

export function naira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDay(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const amountSchema = z
  .number()
  .positive("The amount must be more than 0.")
  .max(100_000_000, "The amount is too large.")
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "Use at most two decimal places.",
  });

export const METHODS = ["cash", "bank_transfer", "pos"] as const;

export const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  pos: "POS",
};