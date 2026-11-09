/** The text the person typed to confirm a permanent delete. */
export async function readConfirm(request: Request): Promise<string> {
  try {
    const body = (await request.json()) as { confirm?: unknown };

    return typeof body.confirm === "string" ? body.confirm.trim() : "";
  } catch {
    return "";
  }
}