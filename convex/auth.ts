import { convexAuth } from "@convex-dev/auth/server"
import { Password } from "@convex-dev/auth/providers/Password"

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password()],
  callbacks: {
    // Link new password accounts to existing users by email (migration from OTP auth)
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId !== null) {
        return existingUserId
      }
      // If a user with this email already exists (e.g. from OTP), link to them
      const email = (profile as { email?: string })?.email
      if (email) {
        const existing = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("email"), email))
          .first()
        if (existing) {
          console.log("Linking password account to existing user:", existing._id)
          return existing._id
        }
      }
      return await ctx.db.insert("users", profile ?? {})
    },
  },
})
