import "server-only";

import { randomInt } from "node:crypto";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

export function generateStudentPassword(length = 12) {
  return Array.from({ length }, () => CHARS[randomInt(CHARS.length)]).join("");
}