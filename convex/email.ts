// Odesílání e-mailů přímo přes Resend (https://resend.com).
// Nahrazuje původní notifikační službu Macaly.
//
// Proměnné prostředí v Convexu (Dashboard → Settings → Environment Variables):
//   RESEND_API_KEY  – API klíč z Resend
//   EMAIL_FROM      – odesílatel, např. "SDH Bor <pokladna@sdhbor.cz>"
//                     (doména musí být v Resend ověřená)

export const appName = () => process.env.APP_NAME || "SDH Hospodaření"

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export async function sendEmail(args: {
  to: string
  subject: string
  text: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    return { ok: false, error: "RESEND_API_KEY nebo EMAIL_FROM není nastaven" }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
    }),
  })

  if (!response.ok) {
    return { ok: false, error: await response.text() }
  }
  return { ok: true }
}
