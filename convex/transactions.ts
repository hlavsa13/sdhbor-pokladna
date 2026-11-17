import { v } from "convex/values"
import { mutation, query, internalMutation, internalQuery } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { getApprovedUserId } from "./access"


export const internalDeleteAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("transactions").collect()
    for (const t of all) {
      await ctx.db.delete(t._id)
    }
    return { deleted: all.length }
  },
})

const DAY_MS = 24 * 60 * 60 * 1000

export const list = query({
  args: {
    type: v.optional(v.union(v.literal("income"), v.literal("expense"))),
    // Bez limitu se vrátí všechny transakce (dříve pevně max. 1000 – nejstarší chyběly)
    limit: v.optional(v.number()),
    // Jen transakce daného roku; rozsah je o den širší kvůli časovým pásmům,
    // přesné rozdělení podle roku dělá klient
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return []

    const year = args.year
    const query =
      year !== undefined
        ? ctx.db
            .query("transactions")
            .withIndex("by_date", (q) =>
              q.gte("date", Date.UTC(year, 0, 1) - DAY_MS).lt("date", Date.UTC(year + 1, 0, 1) + DAY_MS)
            )
            .order("desc")
        : ctx.db.query("transactions").withIndex("by_date").order("desc")

    let allTransactions = args.limit !== undefined ? await query.take(args.limit) : await query.collect()

    if (args.type) {
      allTransactions = allTransactions.filter((t) => t.type === args.type)
    }

    return allTransactions
  },
})

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return null
    
    const transactions = await ctx.db.query("transactions").collect()
    
    // Celkové statistiky
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0)
    
    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)
    
    const balance = totalIncome - totalExpense
    
    // Rozdělení podle způsobu platby (starší transakce bez paymentMethod = hotovost)
    const cashTransactions = transactions.filter((t) => !t.paymentMethod || t.paymentMethod === "cash")
    const bankTransactions = transactions.filter((t) => t.paymentMethod === "bank")
    
    const cashIncome = cashTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0)
    const cashExpense = cashTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)
    const cashBalance = cashIncome - cashExpense
    
    const bankIncome = bankTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0)
    const bankExpense = bankTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)
    const bankBalance = bankIncome - bankExpense
    
    // Statistiky za aktuální rok
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime()
    
    const yearlyTransactions = transactions.filter((t) => t.date >= startOfYear)
    
    const yearlyIncome = yearlyTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0)
    
    const yearlyExpense = yearlyTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)

    const yearlyCashTransactions = yearlyTransactions.filter((t) => !t.paymentMethod || t.paymentMethod === "cash")
    const yearlyBankTransactions = yearlyTransactions.filter((t) => t.paymentMethod === "bank")

    const yearlyCashIncome = yearlyCashTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
    const yearlyCashExpense = yearlyCashTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
    const yearlyBankIncome = yearlyBankTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
    const yearlyBankExpense = yearlyBankTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)

    return {
      totalIncome,
      totalExpense,
      balance,
      cashBalance,
      bankBalance,
      yearlyIncome,
      yearlyExpense,
      yearlyCashIncome,
      yearlyCashExpense,
      yearlyBankIncome,
      yearlyBankExpense,
      currentYear: now.getFullYear(),
      transactionCount: transactions.length,
    }
  },
})

export const getBalanceBeforeYear = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return null

    const startOfYear = new Date(args.year, 0, 1).getTime()

    const allTransactions = await ctx.db.query("transactions").collect()
    const transactions = allTransactions.filter((t) => t.date < startOfYear)

    const cashTx = transactions.filter((t) => !t.paymentMethod || t.paymentMethod === "cash")
    const bankTx = transactions.filter((t) => t.paymentMethod === "bank")

    const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const cashIncome = cashTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const cashExpense = cashTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const bankIncome = bankTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const bankExpense = bankTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)

    return {
      balance: totalIncome - totalExpense,
      cashBalance: cashIncome - cashExpense,
      bankBalance: bankIncome - bankExpense,
    }
  },
})

export const getStatsByYear = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return null

    const startOfYear = new Date(args.year, 0, 1).getTime()
    const endOfYear = new Date(args.year + 1, 0, 1).getTime()

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_date", (q) => q.gte("date", startOfYear).lt("date", endOfYear))
      .collect()

    const cashTx = transactions.filter((t) => !t.paymentMethod || t.paymentMethod === "cash")
    const bankTx = transactions.filter((t) => t.paymentMethod === "bank")

    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const cashIncome = cashTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const cashExpense = cashTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const bankIncome = bankTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const bankExpense = bankTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)

    return { income, expense, cashIncome, cashExpense, bankIncome, bankExpense }
  },
})

export const getMonthlyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return []
    
    const transactions = await ctx.db.query("transactions").collect()
    
    // Seskupit podle měsíců
    const monthlyData: Record<string, { income: number; expense: number }> = {}
    
    transactions.forEach((t) => {
      const date = new Date(t.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      
      if (!monthlyData[key]) {
        monthlyData[key] = { income: 0, expense: 0 }
      }
      
      if (t.type === "income") {
        monthlyData[key].income += t.amount
      } else {
        monthlyData[key].expense += t.amount
      }
    })
    
    // Převést na pole a seřadit
    return Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12) // Posledních 12 měsíců
  },
})

export const getCategoryStats = query({
  args: {
    type: v.union(v.literal("income"), v.literal("expense")),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return []

    let transactions = await ctx.db
      .query("transactions")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .collect()

    if (args.year !== undefined) {
      const start = new Date(args.year, 0, 1).getTime()
      const end = new Date(args.year + 1, 0, 1).getTime()
      transactions = transactions.filter((t) => t.date >= start && t.date < end)
    }

    const categoryData: Record<string, number> = {}
    transactions.forEach((t) => {
      categoryData[t.category] = (categoryData[t.category] ?? 0) + t.amount
    })

    return Object.entries(categoryData)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  },
})

// Výsledek hospodaření podle let
export const getYearlyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return []

    const transactions = await ctx.db.query("transactions").collect()

    const yearlyData: Record<string, { income: number; expense: number }> = {}

    transactions.forEach((t) => {
      const year = String(new Date(t.date).getFullYear())
      if (!yearlyData[year]) {
        yearlyData[year] = { income: 0, expense: 0 }
      }
      if (t.type === "income") {
        yearlyData[year].income += t.amount
      } else {
        yearlyData[year].expense += t.amount
      }
    })

    return Object.entries(yearlyData)
      .map(([year, data]) => ({
        year,
        income: data.income,
        expense: data.expense,
        balance: data.income - data.expense,
      }))
      .sort((a, b) => a.year.localeCompare(b.year))
  },
})

// Výsledek hospodaření podle kategorií (příjmy - výdaje)
export const getCategoryBalanceStats = query({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return []

    let transactions = await ctx.db.query("transactions").collect()

    if (args.year !== undefined) {
      const start = new Date(args.year, 0, 1).getTime()
      const end = new Date(args.year + 1, 0, 1).getTime()
      transactions = transactions.filter((t) => t.date >= start && t.date < end)
    }

    const categoryData: Record<string, { income: number; expense: number }> = {}
    transactions.forEach((t) => {
      if (!categoryData[t.category]) {
        categoryData[t.category] = { income: 0, expense: 0 }
      }
      if (t.type === "income") {
        categoryData[t.category].income += t.amount
      } else {
        categoryData[t.category].expense += t.amount
      }
    })

    return Object.entries(categoryData)
      .map(([category, data]) => ({
        category,
        income: data.income,
        expense: data.expense,
        balance: data.income - data.expense,
      }))
      .sort((a, b) => b.balance - a.balance)
  },
})

export const create = mutation({
  args: {
    type: v.union(v.literal("income"), v.literal("expense")),
    amount: v.number(),
    description: v.string(),
    category: v.string(),
    paymentMethod: v.union(v.literal("cash"), v.literal("bank")),
    date: v.number(),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    // Kontrola role
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile || (profile.role !== "admin" && profile.role !== "deputy")) {
      throw new Error("Nemáte oprávnění přidávat transakce")
    }
    
    const id = await ctx.db.insert("transactions", {
      ...args,
      createdBy: userId,
      createdAt: Date.now(),
    })
    return id
  },
})

export const update = mutation({
  args: {
    id: v.id("transactions"),
    type: v.optional(v.union(v.literal("income"), v.literal("expense"))),
    amount: v.optional(v.number()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("bank"))),
    reimbursed: v.optional(v.boolean()),
    date: v.optional(v.number()),
    receiptStorageId: v.optional(v.id("_storage")),
    removeReceipt: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile) {
      throw new Error("Nemáte oprávnění editovat transakce")
    }
    if (profile.role !== "admin") {
      // deputy může editovat pouze vlastní transakce
      const transaction = await ctx.db.get(args.id)
      if (!transaction || transaction.createdBy !== userId) {
        throw new Error("Nemáte oprávnění editovat tuto transakci")
      }
    }
    
    const { id, removeReceipt, ...updates } = args

    // Pokud chceme smazat účtenku, nastavíme na undefined
    if (removeReceipt) {
      const existing = await ctx.db.get(id)
      if (existing?.receiptStorageId) {
        await ctx.storage.delete(existing.receiptStorageId)
      }
      await ctx.db.patch(id, { receiptStorageId: undefined })
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    )

    await ctx.db.patch(id, filteredUpdates)
  },
})

export const remove = mutation({
  args: {
    id: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    
    if (!profile) {
      throw new Error("Nemáte oprávnění mazat transakce")
    }
    if (profile.role !== "admin") {
      // deputy může mazat pouze vlastní transakce
      const transaction = await ctx.db.get(args.id)
      if (!transaction || transaction.createdBy !== userId) {
        throw new Error("Nemáte oprávnění mazat tuto transakci")
      }
    }
    
    await ctx.db.delete(args.id)
  },
})

// Interní query pro Google Drive sync - vrátí všechny transakce
export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("transactions").collect()
  },
})

export const internalImportTransactions = internalMutation({
  args: {
    transactions: v.array(v.object({
      type: v.union(v.literal("income"), v.literal("expense")),
      amount: v.number(),
      description: v.string(),
      category: v.string(),
      paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("bank"))),
      date: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    // Použijeme první userId z userProfiles jako createdBy
    const profile = await ctx.db.query("userProfiles").first()
    if (!profile) throw new Error("Žádný uživatel nenalezen")
    const userId = profile.userId

    let imported = 0
    for (const t of args.transactions) {
      await ctx.db.insert("transactions", {
        type: t.type,
        amount: t.amount,
        description: t.description,
        category: t.category,
        paymentMethod: t.paymentMethod ?? "cash",
        date: t.date,
        createdBy: userId,
        createdAt: Date.now(),
      })
      imported++
    }
    return { imported }
  },
})

// Hromadný import transakcí
export const importTransactions = mutation({
  args: {
    transactions: v.array(
      v.object({
        type: v.union(v.literal("income"), v.literal("expense")),
        amount: v.number(),
        description: v.string(),
        category: v.string(),
        paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("bank"))),
        date: v.number(),
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
      throw new Error("Nemáte oprávnění importovat transakce")
    }
    
    let imported = 0
    for (const transaction of args.transactions) {
      if (!transaction.description || transaction.amount <= 0) continue
      
      await ctx.db.insert("transactions", {
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category || "Ostatní",
        paymentMethod: transaction.paymentMethod ?? "cash",
        date: transaction.date,
        createdBy: userId,
        createdAt: Date.now(),
      })
      imported++
    }
    
    return { imported }
  },
})