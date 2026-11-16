import { internalAction } from "./_generated/server"
import { v } from "convex/values"

export const sendNewUserNotification = internalAction({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const endpoint = process.env.EMAIL_NOTIFICATION_ENDPOINT
    const recipientEmail = process.env.RECIPIENT_EMAIL
    const chatId = process.env.CHAT_ID
    const appName = process.env.APP_NAME || "SDH Hospodaření"
    const secretKey = process.env.SECRET_KEY

    if (!endpoint || !recipientEmail || !chatId || !secretKey) {
      console.log("Email notification env vars not set, skipping notification")
      return
    }

    const userInfo = args.email ? `${args.name} (${args.email})` : args.name

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toEmail: recipientEmail,
        subject: `Nová žádost o přístup – ${args.name}`,
        message: `Uživatel ${userInfo} se zaregistroval a čeká na schválení přístupu do aplikace ${appName}.\n\nPřihlaste se jako správce a schvalte nebo zamítněte žádost v sekci Nastavení > Uživatelé.`,
        chatId,
        appName,
        secretKey,
      }),
    })

    if (!response.ok) {
      console.log("Failed to send admin notification email:", await response.text())
    } else {
      console.log("Admin notification email sent for new user:", args.name)
    }
  },
})
