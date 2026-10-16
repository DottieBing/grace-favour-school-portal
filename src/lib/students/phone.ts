/** Cleans a phone number so the same parent always matches the same record. */
export function normalizePhone(input: string): string | null {
  let value = input.replace(/[\s\-().]/g, "");

  if (value.startsWith("+234")) {
    value = `0${value.slice(4)}`;
  } else if (value.startsWith("234") && value.length === 13) {
    value = `0${value.slice(3)}`;
  }

  return /^\+?\d{7,15}$/.test(value) ? value : null;
}