// Rozpočet – plánované částky kategorií na rok
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { getApprovedUserId } from "./access"

export const list = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return []
    return await ctx.db
      .query("budgets")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .collect()
  },
})

// Nastaví plán pro kategorii; částka 0 nebo prázdná plán smaže
export const set = mutation({
  args: {
    year: v.number(),
    category: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    if (!profile || profile.role !== "admin") throw new Error("Rozpočet může upravovat jen hospodář")

    const existing = (
      await ctx.db
        .query("budgets")
        .withIndex("by_year", (q) => q.eq("year", args.year))
        .collect()
    ).find((b) => b.category === args.category && b.type === args.type)

    if (!isFinite(args.amount) || args.amount <= 0) {
      if (existing) await ctx.db.delete(existing._id)
      return
    }
    if (existing) {
      await ctx.db.patch(existing._id, { amount: args.amount, updatedAt: Date.now() })
    } else {
      await ctx.db.insert("budgets", { ...args, updatedAt: Date.now() })
    }
  },
})
