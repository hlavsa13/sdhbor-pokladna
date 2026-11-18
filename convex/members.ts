import { v } from "convex/values"
import { mutation, query, internalMutation, type QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { getAuthUserId } from "@convex-dev/auth/server"
import { getApprovedUserId } from "./access"

// Osobní údaje (e-mail, telefon, datum narození) vidí jen hospodář, zástupce a tajemník.
// Ostatní schválení uživatelé vidí jméno, typ člena a stav příspěvků.
async function canSeePersonalData(ctx: QueryCtx, userId: Id<"users">) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first()
  return !!profile && ["admin", "deputy", "secretary"].includes(profile.role)
}

function withoutPersonalData<T extends { email?: string; phone?: string; birthDate?: number }>(member: T): T {
  return { ...member, email: undefined, phone: undefined, birthDate: undefined } as T
}

export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return []
    
    const members = args.activeOnly
      ? await ctx.db
          .query("members")
          .withIndex("by_active", (q) => q.eq("active", true))
          .collect()
      : await ctx.db.query("members").collect()
    
    // Přidat informace o příspěvcích za aktuální rok
    const currentYear = new Date().getFullYear()
    const membersWithFees = await Promise.all(
      members.map(async (member) => {
        const fee = await ctx.db
          .query("membershipFees")
          .withIndex("by_memberId", (q) => q.eq("memberId", member._id))
          .filter((q) => q.eq(q.field("year"), currentYear))
          .first()
        
        return {
          ...member,
          currentYearFee: fee,
        }
      })
    )
    
    // Seřadit podle příjmení, pak jména (abecedně)
    membersWithFees.sort((a, b) => {
      const lastNameCmp = a.lastName.localeCompare(b.lastName, "cs")
      if (lastNameCmp !== 0) return lastNameCmp
      return a.firstName.localeCompare(b.firstName, "cs")
    })

    if (!(await canSeePersonalData(ctx, userId))) {
      return membersWithFees.map(withoutPersonalData)
    }
    return membersWithFees
  },
})

export const get = query({
  args: {
    id: v.id("members"),
  },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return null
    
    const member = await ctx.db.get(args.id)
    if (!member) return null
    
    // Načíst historii příspěvků
    const fees = await ctx.db
      .query("membershipFees")
      .withIndex("by_memberId", (q) => q.eq("memberId", args.id))
      .collect()
    
    const result = {
      ...member,
      fees: fees.sort((a, b) => b.year - a.year),
    }
    return (await canSeePersonalData(ctx, userId)) ? result : withoutPersonalData(result)
  },
})

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return null
    
    const members = await ctx.db.query("members").collect()
    const activeMembers = members.filter((m) => m.active)
    
    const currentYear = new Date().getFullYear()
    const fees = await ctx.db
      .query("membershipFees")
      .withIndex("by_year", (q) => q.eq("year", currentYear))
      .collect()
    
    const paidFees = fees.filter((f) => f.status === "paid")
    const totalCollected = paidFees.reduce((sum, f) => sum + f.amount, 0)

    // Vyřízené příspěvky aktivních členů: zaplaceno nebo osvobozeno (60+)
    const feeByMember = new Map(fees.map((f) => [f.memberId, f.status]))
    const settledCount = activeMembers.filter((m) => {
      const status = feeByMember.get(m._id)
      return status === "paid" || status === "exempt" || (!status && m.over60)
    }).length
    
    return {
      totalMembers: members.length,
      activeMembers: activeMembers.length,
      paidFeesCount: settledCount,
      unpaidFeesCount: fees.length - paidFees.length,
      totalCollected,
    }
  },
})

export const create = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    memberType: v.optional(v.union(v.literal("man"), v.literal("woman"), v.literal("child"))),
    birthDate: v.optional(v.number()),
    joinedAt: v.number(),
    over60: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile || profile.role !== "admin") {
      throw new Error("Nemáte oprávnění přidávat členy")
    }
    
    return await ctx.db.insert("members", {
      ...args,
      active: true,
      over60: args.over60 ?? false,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("members"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    memberType: v.optional(v.union(v.literal("man"), v.literal("woman"), v.literal("child"))),
    birthDate: v.optional(v.number()),
    joinedAt: v.optional(v.number()),
    active: v.optional(v.boolean()),
    over60: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile || (profile.role !== "admin" && profile.role !== "secretary")) {
      throw new Error("Nemáte oprávnění upravovat členy")
    }
    
    const { id, ...updates } = args
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    )
    
    await ctx.db.patch(id, filteredUpdates)
  },
})

export const remove = mutation({
  args: {
    id: v.id("members"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile || profile.role !== "admin") {
      throw new Error("Nemáte oprávnění mazat členy")
    }
    
    // Smazat i příspěvky člena
    const fees = await ctx.db
      .query("membershipFees")
      .withIndex("by_memberId", (q) => q.eq("memberId", args.id))
      .collect()
    
    for (const fee of fees) {
      await ctx.db.delete(fee._id)
    }
    
    await ctx.db.delete(args.id)
  },
})

// Příspěvky
export const createFee = mutation({
  args: {
    memberId: v.id("members"),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile || (profile.role !== "admin" && profile.role !== "secretary")) {
      throw new Error("Nemáte oprávnění spravovat příspěvky")
    }
    
    // Zkontrolovat, zda už neexistuje příspěvek pro tento rok
    const existing = await ctx.db
      .query("membershipFees")
      .withIndex("by_memberId", (q) => q.eq("memberId", args.memberId))
      .filter((q) => q.eq(q.field("year"), args.year))
      .first()
    
    if (existing) {
      throw new Error("Příspěvek za tento rok již existuje")
    }
    
    // Získat údaje o členovi pro určení výše příspěvku
    const member = await ctx.db.get(args.memberId)
    if (!member) throw new Error("Člen nenalezen")
    
    // Členi nad 60 let neplatí
    if (member.over60) {
      return await ctx.db.insert("membershipFees", {
        memberId: args.memberId,
        year: args.year,
        amount: 0,
        status: "exempt",
        createdAt: Date.now(),
      })
    }
    
    // Načíst výši příspěvků z nastavení
    const adultSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "feeAmount_adult"))
      .first()
    
    const childSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "feeAmount_child"))
      .first()
    
    const adultAmount = adultSetting?.value ?? 200
    const childAmount = childSetting?.value ?? 100
    
    // Výše příspěvku podle typu člena
    const amount = member.memberType === "child" ? childAmount : adultAmount
    
    return await ctx.db.insert("membershipFees", {
      memberId: args.memberId,
      year: args.year,
      amount,
      status: "unpaid",
      createdAt: Date.now(),
    })
  },
})

export const updateFee = mutation({
  args: {
    id: v.id("membershipFees"),
    status: v.union(v.literal("paid"), v.literal("unpaid"), v.literal("exempt")),
    paidAt: v.optional(v.number()),
    paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("bank"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile || (profile.role !== "admin" && profile.role !== "secretary")) {
      throw new Error("Nemáte oprávnění spravovat příspěvky")
    }
    
    if (args.status === "paid") {
      await ctx.db.patch(args.id, {
        status: args.status,
        paidAt: args.paidAt ?? Date.now(),
        paymentMethod: args.paymentMethod,
      })
    } else {
      await ctx.db.patch(args.id, {
        status: args.status,
        paidAt: undefined,
        paymentMethod: undefined,
      })
    }
  },
})

// Interní hromadné označení (bez autentizace – pro CLI)
export const internalMarkAllFeesPaidForYear = internalMutation({
  args: {
    year: v.number(),
    paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("bank"))),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db.query("members").collect()
    const activeMembers = members.filter((m) => m.active)

    const adultSetting = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "feeAmount_adult")).first()
    const childSetting = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "feeAmount_child")).first()
    const adultAmount = adultSetting?.value ?? 200
    const childAmount = childSetting?.value ?? 100

    let created = 0
    let updated = 0
    let skipped = 0

    for (const member of activeMembers) {
      const existing = await ctx.db
        .query("membershipFees")
        .withIndex("by_memberId", (q) => q.eq("memberId", member._id))
        .filter((q) => q.eq(q.field("year"), args.year))
        .first()

      if (member.over60) {
        if (!existing) {
          await ctx.db.insert("membershipFees", { memberId: member._id, year: args.year, amount: 0, status: "exempt", createdAt: Date.now() })
          created++
        } else { skipped++ }
        continue
      }

      const amount = member.memberType === "child" ? childAmount : adultAmount

      if (existing) {
        if (existing.status === "paid") { skipped++ }
        else {
          await ctx.db.patch(existing._id, { status: "paid", paidAt: Date.now(), paymentMethod: args.paymentMethod })
          updated++
        }
      } else {
        await ctx.db.insert("membershipFees", { memberId: member._id, year: args.year, amount, status: "paid", paidAt: Date.now(), paymentMethod: args.paymentMethod, createdAt: Date.now() })
        created++
      }
    }

    return { created, updated, skipped }
  },
})

// Hromadně označit všechny příspěvky za daný rok jako zaplacené
export const markAllFeesPaidForYear = mutation({
  args: {
    year: v.number(),
    paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("bank"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()

    if (!profile || (profile.role !== "admin" && profile.role !== "secretary")) {
      throw new Error("Nemáte oprávnění spravovat příspěvky")
    }

    const members = await ctx.db.query("members").collect()
    const activeMembers = members.filter((m) => m.active)

    const adultSetting = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "feeAmount_adult")).first()
    const childSetting = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "feeAmount_child")).first()
    const adultAmount = adultSetting?.value ?? 200
    const childAmount = childSetting?.value ?? 100

    let created = 0
    let updated = 0
    let skipped = 0

    for (const member of activeMembers) {
      const existing = await ctx.db
        .query("membershipFees")
        .withIndex("by_memberId", (q) => q.eq("memberId", member._id))
        .filter((q) => q.eq(q.field("year"), args.year))
        .first()

      if (member.over60) {
        // Osvobozeni – jen zajistit záznam exempt
        if (!existing) {
          await ctx.db.insert("membershipFees", {
            memberId: member._id,
            year: args.year,
            amount: 0,
            status: "exempt",
            createdAt: Date.now(),
          })
          created++
        } else {
          skipped++
        }
        continue
      }

      const amount = member.memberType === "child" ? childAmount : adultAmount

      if (existing) {
        if (existing.status === "paid") {
          skipped++
        } else {
          await ctx.db.patch(existing._id, {
            status: "paid",
            paidAt: Date.now(),
            paymentMethod: args.paymentMethod,
          })
          updated++
        }
      } else {
        await ctx.db.insert("membershipFees", {
          memberId: member._id,
          year: args.year,
          amount,
          status: "paid",
          paidAt: Date.now(),
          paymentMethod: args.paymentMethod,
          createdAt: Date.now(),
        })
        created++
      }
    }

    console.log(`markAllFeesPaidForYear ${args.year}: created=${created}, updated=${updated}, skipped=${skipped}`)
    return { created, updated, skipped }
  },
})

// Hromadný import členů
export const importMembers = mutation({
  args: {
    members: v.array(
      v.object({
        firstName: v.string(),
        lastName: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        memberType: v.optional(v.union(v.literal("man"), v.literal("woman"), v.literal("child"))),
        birthDate: v.optional(v.number()),
        joinedAt: v.optional(v.number()),
        over60: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile || profile.role !== "admin") {
      throw new Error("Nemáte oprávnění importovat členy")
    }
    
    let imported = 0
    for (const member of args.members) {
      if (!member.firstName || !member.lastName) continue
      
      await ctx.db.insert("members", {
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        memberType: member.memberType ?? "man",
        birthDate: member.birthDate,
        joinedAt: member.joinedAt ?? Date.now(),
        over60: member.over60 ?? false,
        active: true,
        createdAt: Date.now(),
      })
      imported++
    }
    
    return { imported }
  },
})

// Smazat všechny členy (interní funkce)
export const deleteAll = internalMutation({
  args: {
    confirmDelete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Bezpečnostní pojistka
    if (!args.confirmDelete) {
      throw new Error("Potvrďte smazání nastavením confirmDelete: true")
    }
    
    // Smazat všechny příspěvky
    const fees = await ctx.db.query("membershipFees").collect()
    for (const fee of fees) {
      await ctx.db.delete(fee._id)
    }
    
    // Smazat všechny členy
    const members = await ctx.db.query("members").collect()
    for (const member of members) {
      await ctx.db.delete(member._id)
    }
    
    return { deleted: members.length }
  },
})
