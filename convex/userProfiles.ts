import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { internal } from "./_generated/api"

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    
    const user = await ctx.db.get(userId)
    if (!user) return null
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    return {
      id: userId,
      email: user.email,
      profile,
    }
  },
})

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    return profile?.role === "admin"
  },
})

export const createProfile = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (existing) {
      // Profil již existuje - idempotentní, vracíme stávající hodnoty
      return { role: existing.role, approved: existing.approved ?? false }
    }
    
    // První uživatel = admin, automaticky schválený
    const allProfiles = await ctx.db.query("userProfiles").collect()
    const isFirst = allProfiles.length === 0
    const role = isFirst ? "admin" : "member"
    const approved = isFirst

    // Získat e-mail uživatele pro notifikaci
    const user = await ctx.db.get(userId)
    
    await ctx.db.insert("userProfiles", {
      userId,
      name: args.name,
      role,
      approved,
      createdAt: Date.now(),
    })

    // Odeslat notifikaci správci (jen pro nové členy, ne pro prvního admina)
    if (!isFirst) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendNewUserNotification, {
        name: args.name,
        email: user?.email,
      })
    }

    return { role, approved }
  },
})

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile) throw new Error("Profil neexistuje")
    
    const updates = Object.fromEntries(
      Object.entries(args).filter(([_, v]) => v !== undefined)
    )
    
    await ctx.db.patch(profile._id, updates)
  },
})

export const isSecretary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    return profile?.role === "secretary"
  },
})

export const isDeputy = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    return profile?.role === "deputy"
  },
})

export const setUserRole = mutation({
  args: {
    profileId: v.id("userProfiles"),
    role: v.union(v.literal("admin"), v.literal("secretary"), v.literal("deputy"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Nemáte oprávnění měnit role")
    }
    
    await ctx.db.patch(args.profileId, { role: args.role })
  },
})

export const approveUser = mutation({
  args: {
    profileId: v.id("userProfiles"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Nemáte oprávnění schvalovat uživatele")
    }
    
    await ctx.db.patch(args.profileId, { approved: true })
  },
})

export const deleteUser = mutation({
  args: {
    profileId: v.id("userProfiles"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")

    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()

    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Nemáte oprávnění mazat uživatele")
    }

    const targetProfile = await ctx.db.get(args.profileId)
    if (!targetProfile) throw new Error("Uživatel neexistuje")

    if (targetProfile.userId === userId) {
      throw new Error("Nemůžete smazat sám sebe")
    }

    await ctx.db.delete(args.profileId)
  },
})

export const rejectUser = mutation({
  args: {
    profileId: v.id("userProfiles"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!currentProfile || currentProfile.role !== "admin") {
      throw new Error("Nemáte oprávnění zamítat uživatele")
    }
    
    // Smazat profil (uživatel se může zkusit znovu)
    await ctx.db.delete(args.profileId)
  },
})

// Zkusí udělat aktuálního uživatele adminem pokud:
// (a) jde o úplně prvního uživatele aplikace (žádný jiný profil neexistuje), NEBO
// (b) existuje admin profil se stejným e-mailem (migrace ze starého účtu)
// E-mail čteme z authAccounts (providerAccountId pro password provider) – spolehlivější než users.email
export const claimAdminIfNoneExists = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      console.log("claimAdminIfNoneExists: start")
      const userId = await getAuthUserId(ctx)
      if (!userId) {
        console.log("claimAdminIfNoneExists: no userId, not authenticated")
        return false
      }
      console.log("claimAdminIfNoneExists: userId =", String(userId))

      // Profil aktuálního uživatele
      const myProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first()
      console.log("claimAdminIfNoneExists: myProfile role =", myProfile?.role, "approved =", myProfile?.approved)

      // Již je admin – nic neděláme
      if (myProfile?.role === "admin" && myProfile?.approved === true) {
        console.log("claimAdminIfNoneExists: already admin, done")
        return true
      }

      // E-mail aktuálního uživatele z authAccounts (pro password provider = providerAccountId)
      const myAccount = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "password")
        )
        .first()
      const myEmail = myAccount?.providerAccountId ?? null
      console.log("claimAdminIfNoneExists: myEmail =", myEmail)

      // Načteme všechny schválené adminy
      const allProfiles = await ctx.db.query("userProfiles").collect()
      const approvedAdmins = allProfiles.filter(
        (p) => p.role === "admin" && p.approved === true
      )
      console.log("claimAdminIfNoneExists: approvedAdmins count =", approvedAdmins.length)

      // Zjistíme, zda některý admin má stejný e-mail (migrace)
      let sameEmailAdminExists = false
      if (myEmail !== null && approvedAdmins.length > 0) {
        for (const admin of approvedAdmins) {
          console.log("claimAdminIfNoneExists: checking admin userId =", String(admin.userId))
          const adminAccount = await ctx.db
            .query("authAccounts")
            .withIndex("userIdAndProvider", (q) =>
              q.eq("userId", admin.userId).eq("provider", "password")
            )
            .first()
          const adminEmail = adminAccount?.providerAccountId ?? null
          console.log("claimAdminIfNoneExists: admin email =", adminEmail)
          if (adminEmail !== null && adminEmail === myEmail) {
            sameEmailAdminExists = true
            break
          }
        }
      }
      console.log("claimAdminIfNoneExists: sameEmailAdminExists =", sameEmailAdminExists)

      // Povýšíme pouze pokud: jde o úplně prvního uživatele aplikace (žádný jiný profil),
      // NEBO má stejný e-mail jako stávající hospodář (migrace účtu).
      // Dříve stačilo, že žádný hospodář neexistuje – po smazání jeho profilu by se
      // hospodářem stal kdokoli, kdo se zaregistruje.
      const otherProfiles = allProfiles.filter((p) => p.userId !== userId)
      const isFirstUser = approvedAdmins.length === 0 && otherProfiles.length === 0
      if (!isFirstUser && !sameEmailAdminExists) {
        console.log("claimAdminIfNoneExists: podmínka nesplněna – nejde o prvního uživatele ani migraci")
        return false
      }

      if (myProfile) {
        console.log("claimAdminIfNoneExists: patch profilu na admin")
        await ctx.db.patch(myProfile._id, { role: "admin", approved: true })
        console.log("claimAdminIfNoneExists: profil povýšen na admin")
      } else {
        const displayName = myEmail ?? "Správce"
        console.log("claimAdminIfNoneExists: insert nového admin profilu, name =", displayName)
        await ctx.db.insert("userProfiles", {
          userId,
          name: displayName,
          role: "admin",
          approved: true,
          createdAt: Date.now(),
        })
        console.log("claimAdminIfNoneExists: nový admin profil vytvořen")
      }
      return true
    } catch (err) {
      console.log("claimAdminIfNoneExists caught error:", String(err))
      return false
    }
  },
})

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    
    const currentProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!currentProfile || currentProfile.role !== "admin") {
      return []
    }
    
    const profiles = await ctx.db.query("userProfiles").collect()
    
    return Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId)
        return {
          ...profile,
          email: user?.email,
        }
      })
    )
  },
})
