import "server-only";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function codeEmail(args: {
  schoolName: string;
  heading: string;
  intro: string;
  code: string;
  minutes: number;
}) {
  const school = escapeHtml(args.schoolName);

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#203432;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:14px;font-weight:bold;color:#0d5c63;">${school}</td></tr>
          <tr><td style="padding-top:16px;font-size:20px;font-weight:bold;">${escapeHtml(args.heading)}</td></tr>
          <tr><td style="padding-top:8px;font-size:14px;line-height:22px;color:#53645d;">${escapeHtml(args.intro)}</td></tr>
          <tr><td align="center" style="padding:24px 0;">
            <span style="display:inline-block;background:#f1f8f7;border-radius:12px;padding:14px 28px;font-size:32px;letter-spacing:8px;font-weight:bold;color:#0d5c63;">${args.code}</span>
          </td></tr>
          <tr><td style="font-size:13px;line-height:20px;color:#7d8983;">
            This code expires in ${args.minutes} minutes. If you didn't ask for it, you can ignore this email. Nobody can use it without access to your inbox, and the school will never ask you for it.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `${args.schoolName}\n\n${args.heading}\n\n${args.intro}\n\nYour code: ${args.code}\n\nIt expires in ${args.minutes} minutes. If you didn't ask for it, ignore this email. The school will never ask you for this code.`;

  return { html, text };
}