// Společné kontroly přístupu pro Convex funkce.
import { getAuthUserId } from "@convex-dev/auth/server"
import { internalQuery, type QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

export type Role = Doc<"userProfiles">["role"]

async function getProfile(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first()
}

/**
 * Vrátí ID přihlášeného uživatele jen tehdy, pokud má profil a správce ho schválil.
 * Starší profily bez pole `approved` se berou jako schválené (stejně jako v UI).
 * Jinak vrací null – dotazy pak nevrátí žádná data.
 */
export async function getApprovedUserId(ctx: QueryCtx): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx)
  if (!userId) return null
  const profile = await getProfile(ctx, userId)
  if (!profile || profile.approved === false) return null
  return userId
}

/** Vyhodí chybu, pokud uživatel není schválený nebo nemá jednu z rolí. */
export async function requireRole(ctx: QueryCtx, roles: Role[]) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error("Nepřihlášený uživatel")
  const profile = await getProfile(ctx, userId)
  if (!profile || profile.approved === false || !roles.includes(profile.role)) {
    throw new Error("Nemáte oprávnění")
  }
  return { userId, profile }
}

/** Pro akce (actions), které nemají přímý přístup k databázi. */
export const internalCurrentRole = internalQuery({
  args: {},
  handler: async (ctx): Promise<Role | null> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const profile = await getProfile(ctx, userId)
    if (!profile || profile.approved === false) return null
    return profile.role
  },
})
