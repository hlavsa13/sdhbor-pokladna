import { action, internalMutation, internalQuery } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { Scrypt } from "lucia"

// Internal: get user by email (any provider)
export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first()
  },
})

// Internal: store reset token (replaces any existing ones for this email)
export const storeResetToken = internalMutation({
  args: { email: v.string(), code: v.string(), expiresAt: v.number() },
  handler: async (ctx, { email, code, expiresAt }) => {
    const existing = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect()
    for (const token of existing) {
      await ctx.db.delete(token._id)
    }
    await ctx.db.insert("passwordResetTokens", { email, code, expiresAt })
    console.log("Reset token stored for:", email)
  },
})

// Internal: verify code + set password on authAccounts
export const applyPasswordReset = internalMutation({
  args: { email: v.string(), code: v.string(), hashedPassword: v.string() },
  handler: async (ctx, { email, code, hashedPassword }) => {
    // Verify the reset token
    const token = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()
    if (!token) throw new Error("Neplatný nebo prošlý kód.")
    if (Date.now() > token.expiresAt) throw new Error("Kód vypršel.")
    if (token.code !== code) throw new Error("Neplatný kód.")

    // Find the user (any provider)
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first()
    if (!user) throw new Error("Uživatel nenalezen.")

    // Create or update the password provider account
    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email)
      )
      .unique()

    if (existingAccount) {
      await ctx.db.patch(existingAccount._id, { secret: hashedPassword })
      console.log("Password account updated for:", email)
    } else {
      await ctx.db.insert("authAccounts", {
        provider: "password",
        providerAccountId: email,
        userId: user._id,
        secret: hashedPassword,
      })
      console.log("Password account created for:", email)
    }

    // Delete the used token
    await ctx.db.delete(token._id)
  },
})

// Public action: request password reset (sends 6-digit code)
export const requestReset = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.runQuery(internal.passwordReset.getUserByEmail, { email })
    if (!user) {
      // Don't reveal whether email exists — silently succeed
      console.log("Reset requested for unknown email:", email)
      return
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + 60 * 60 * 1000 // 1 hour

    await ctx.runMutation(internal.passwordReset.storeResetToken, { email, code, expiresAt })

    // Send email via Macaly notification service
    const endpoint = process.env.EMAIL_NOTIFICATION_ENDPOINT
    const chatId = process.env.CHAT_ID
    const appName = process.env.APP_NAME || "SDH Hospodaření"
    const secretKey = process.env.SECRET_KEY

    if (!endpoint || !chatId || !secretKey) {
      console.log("Email env vars not set, cannot send reset code")
      throw new Error("E-mailové notifikace nejsou nakonfigurovány.")
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toEmail: email,
        subject: `Reset hesla – ${appName}`,
        message: `Váš kód pro reset hesla v aplikaci ${appName}:\n\n${code}\n\nKód platí 1 hodinu. Pokud jste o reset nežádali, ignorujte tento e-mail.`,
        chatId,
        appName,
        secretKey,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.log("Failed to send reset email:", body)
      throw new Error("Nepodařilo se odeslat e-mail s kódem.")
    }

    console.log("Password reset email sent to:", email)
  },
})

// Public action: verify code + set new password
export const confirmReset = action({
  args: { email: v.string(), code: v.string(), newPassword: v.string() },
  handler: async (ctx, { email, code, newPassword }) => {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Heslo musí mít alespoň 8 znaků.")
    }

    const hashedPassword = await new Scrypt().hash(newPassword)
    await ctx.runMutation(internal.passwordReset.applyPasswordReset, {
      email,
      code,
      hashedPassword,
    })

    console.log("Password reset complete for:", email)
  },
})
