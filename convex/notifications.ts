import { internalAction } from "./_generated/server"
import { v } from "convex/values"
import { appName, isEmailConfigured, sendEmail } from "./email"

export const sendNewUserNotification = internalAction({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const recipientEmail = process.env.RECIPIENT_EMAIL

    if (!recipientEmail || !isEmailConfigured()) {
      console.log("Email notification env vars not set, skipping notification")
      return
    }

    const userInfo = args.email ? `${args.name} (${args.email})` : args.name

    const result = await sendEmail({
      to: recipientEmail,
      subject: `Nová žádost o přístup – ${args.name}`,
      text: `Uživatel ${userInfo} se zaregistroval a čeká na schválení přístupu do aplikace ${appName()}.\n\nPřihlaste se jako správce a schvalte nebo zamítněte žádost v sekci Nastavení > Uživatelé.`,
    })

    if (!result.ok) {
      console.log("Failed to send admin notification email:", result.error)
    } else {
      console.log("Admin notification email sent for new user:", args.name)
    }
  },
})
