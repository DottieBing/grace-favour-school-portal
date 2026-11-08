import "server-only";

/** Sends one email through Resend. Returns false (and logs why) if it fails. */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key || !from) {
    console.error("Email isn't configured: set RESEND_API_KEY and EMAIL_FROM.");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });

    if (!response.ok) {
      console.error(
        "Resend refused the email:",
        response.status,
        await response.text().catch(() => ""),
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Sending the email failed:", error);
    return false;
  }
}