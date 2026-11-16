import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getApprovedUserId, requireRole } from "./access"

// Nahrávat účtenky smí jen ten, kdo smí zakládat transakce
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "deputy"])
    return await ctx.storage.generateUploadUrl()
  },
})

export const getReceiptUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return null
    return await ctx.storage.getUrl(args.storageId)
  },
})

export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin"])
    await ctx.storage.delete(args.storageId)
  },
})
