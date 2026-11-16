import { action, internalMutation, internalQuery } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { Scrypt } from "lucia"
import { appName, isEmailConfigured, sendEmail } from "./email"

const MAX_ATTEMPTS = 5
const CODE_VALIDITY_MS = 15 * 60 * 1000 // 15 minut

function generateCode(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(100000 + (array[0] % 900000))
}

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
    await ctx.db.insert("passwordResetTokens", { email, code, expiresAt, attempts: 0 })
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
    // Chyby vracíme (nevyhazujeme), aby se uložil počet neúspěšných pokusů –
    // vyhozená výjimka by změny v mutaci vrátila zpět.
    if (!token) return { ok: false as const, error: "Neplatný nebo prošlý kód." }
    if (Date.now() > token.expiresAt) {
      await ctx.db.delete(token._id)
      return { ok: false as const, error: "Kód vypršel. Požádejte o nový." }
    }
    if (token.code !== code) {
      const attempts = (token.attempts ?? 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        await ctx.db.delete(token._id)
        return { ok: false as const, error: "Příliš mnoho pokusů. Požádejte o nový kód." }
      }
      await ctx.db.patch(token._id, { attempts })
      return { ok: false as const, error: "Neplatný kód." }
    }

    // Find the user (any provider)
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first()
    if (!user) return { ok: false as const, error: "Uživatel nenalezen." }

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
    return { ok: true as const }
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

    const code = generateCode()
    const expiresAt = Date.now() + CODE_VALIDITY_MS

    await ctx.runMutation(internal.passwordReset.storeResetToken, { email, code, expiresAt })

    if (!isEmailConfigured()) {
      console.log("Email env vars not set, cannot send reset code")
      throw new Error("E-mailové notifikace nejsou nakonfigurovány.")
    }

    const result = await sendEmail({
      to: email,
      subject: `Reset hesla – ${appName()}`,
      text: `Váš kód pro reset hesla v aplikaci ${appName()}:\n\n${code}\n\nKód platí 15 minut. Pokud jste o reset nežádali, ignorujte tento e-mail.`,
    })

    if (!result.ok) {
      console.log("Failed to send reset email:", result.error)
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
    const result = await ctx.runMutation(internal.passwordReset.applyPasswordReset, {
      email,
      code,
      hashedPassword,
    })
    if (!result.ok) throw new Error(result.error)

    console.log("Password reset complete for:", email)
  },
})
