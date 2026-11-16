import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

// Výchozí hodnoty příspěvků
const DEFAULT_FEE_AMOUNTS = {
  adult: 200, // Muži a ženy
  child: 100, // Děti do 18 let
}

export const getFeeAmounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return DEFAULT_FEE_AMOUNTS
    
    const adultSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "feeAmount_adult"))
      .first()
    
    const childSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "feeAmount_child"))
      .first()
    
    return {
      adult: adultSetting?.value ?? DEFAULT_FEE_AMOUNTS.adult,
      child: childSetting?.value ?? DEFAULT_FEE_AMOUNTS.child,
    }
  },
})

export const updateFeeAmounts = mutation({
  args: {
    adult: v.number(),
    child: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile || profile.role !== "admin") {
      throw new Error("Nemáte oprávnění měnit nastavení")
    }
    
    // Aktualizovat nebo vytvořit nastavení pro dospělé
    const adultSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "feeAmount_adult"))
      .first()
    
    if (adultSetting) {
      await ctx.db.patch(adultSetting._id, {
        value: args.adult,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert("appSettings", {
        key: "feeAmount_adult",
        value: args.adult,
        updatedAt: Date.now(),
      })
    }
    
    // Aktualizovat nebo vytvořit nastavení pro děti
    const childSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "feeAmount_child"))
      .first()
    
    if (childSetting) {
      await ctx.db.patch(childSetting._id, {
        value: args.child,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert("appSettings", {
        key: "feeAmount_child",
        value: args.child,
        updatedAt: Date.now(),
      })
    }
  },
})
