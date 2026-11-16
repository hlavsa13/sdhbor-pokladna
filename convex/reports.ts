import { v } from "convex/values"
import { query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { getApprovedUserId } from "./access"

export const getValnaHromadaData = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx)
    if (!userId) return null

    const startOfYear = new Date(args.year, 0, 1).getTime()
    const endOfYear = new Date(args.year + 1, 0, 1).getTime()

    // Get all transactions for the year
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_date", (q) => q.gte("date", startOfYear).lt("date", endOfYear))
      .collect()

    // Financial calculations
    const incomeTransactions = transactions.filter((t) => t.type === "income")
    const expenseTransactions = transactions.filter((t) => t.type === "expense")

    const income = incomeTransactions.reduce((sum, t) => sum + t.amount, 0)
    const expense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0)
    const balance = income - expense

    // Cash transactions
    const cashIncomeTx = incomeTransactions.filter((t) => !t.paymentMethod || t.paymentMethod === "cash")
    const cashExpenseTx = expenseTransactions.filter((t) => !t.paymentMethod || t.paymentMethod === "cash")
    const cashIncome = cashIncomeTx.reduce((sum, t) => sum + t.amount, 0)
    const cashExpense = cashExpenseTx.reduce((sum, t) => sum + t.amount, 0)
    const cashBalance = cashIncome - cashExpense

    // Bank transactions
    const bankIncomeTx = incomeTransactions.filter((t) => t.paymentMethod === "bank")
    const bankExpenseTx = expenseTransactions.filter((t) => t.paymentMethod === "bank")
    const bankIncome = bankIncomeTx.reduce((sum, t) => sum + t.amount, 0)
    const bankExpense = bankExpenseTx.reduce((sum, t) => sum + t.amount, 0)
    const bankBalance = bankIncome - bankExpense

    // Income by category
    const incomeByCategoryMap = new Map<string, number>()
    for (const t of incomeTransactions) {
      const current = incomeByCategoryMap.get(t.category) ?? 0
      incomeByCategoryMap.set(t.category, current + t.amount)
    }
    const incomeByCategory = Array.from(incomeByCategoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Expense by category
    const expenseByCategoryMap = new Map<string, number>()
    for (const t of expenseTransactions) {
      const current = expenseByCategoryMap.get(t.category) ?? 0
      expenseByCategoryMap.set(t.category, current + t.amount)
    }
    const expenseByCategory = Array.from(expenseByCategoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Get all active members
    const members = await ctx.db
      .query("members")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect()

    // Get fees for each member for the requested year
    const membersWithFees = await Promise.all(
      members.map(async (member) => {
        const fee = await ctx.db
          .query("membershipFees")
          .withIndex("by_memberId", (q) => q.eq("memberId", member._id))
          .filter((q) => q.eq(q.field("year"), args.year))
          .first()

        return {
          firstName: member.firstName,
          lastName: member.lastName,
          memberType: member.memberType,
          over60: member.over60 ?? false,
          feeStatus: fee?.status ?? null,
          feeAmount: fee?.amount ?? null,
          feePaymentMethod: fee?.paymentMethod ?? null,
        }
      })
    )

    // Sort by lastName then firstName
    membersWithFees.sort((a, b) => {
      const lastNameCmp = a.lastName.localeCompare(b.lastName, "cs")
      if (lastNameCmp !== 0) return lastNameCmp
      return a.firstName.localeCompare(b.firstName, "cs")
    })

    // Calculate member stats
    const total = membersWithFees.length
    const paid = membersWithFees.filter((m) => m.feeStatus === "paid").length
    const unpaid = membersWithFees.filter((m) => m.feeStatus === "unpaid").length
    const exempt = membersWithFees.filter((m) => m.feeStatus === "exempt").length

    return {
      year: args.year,
      financials: {
        income,
        expense,
        balance,
        cashIncome,
        cashExpense,
        cashBalance,
        bankIncome,
        bankExpense,
        bankBalance,
        incomeByCategory,
        expenseByCategory,
      },
      members: {
        total,
        paid,
        unpaid,
        exempt,
        list: membersWithFees,
      },
    }
  },
})
