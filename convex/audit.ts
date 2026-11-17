// Historie změn transakcí – kdo, kdy a co přidal, upravil nebo smazal.
import { v } from "convex/values"
import { mutation, query, type MutationCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { getAuthUserId } from "@convex-dev/auth/server"

type Tx = Doc<"transactions">

// Částka ve tvaru 12 345,50 (bez závislosti na Intl)
export function formatAmount(amount: number): string {
  const [int, dec] = Math.abs(amount).toFixed(2).split(".")
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return (amount < 0 ? "−" : "") + (dec === "00" ? grouped : `${grouped},${dec}`)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`
}

const payment = (m?: string) => (m === "bank" ? "banka" : "hotovost")

export function describeTx(t: Tx): string {
  const sign = t.type === "income" ? "+" : "−"
  return `${t.description} ${sign}${formatAmount(t.amount)} (${t.category}, ${payment(t.paymentMethod)}, ${formatDate(t.date)})`
}

// Popis rozdílů mezi starou a novou verzí transakce
export function describeChanges(before: Tx, after: Tx): string {
  const changes: string[] = []
  if (before.type !== after.type) changes.push(`typ ${before.type === "income" ? "příjem" : "výdaj"} → ${after.type === "income" ? "příjem" : "výdaj"}`)
  if (before.amount !== after.amount) changes.push(`částka ${formatAmount(before.amount)} → ${formatAmount(after.amount)}`)
  if (before.description !== after.description) changes.push(`popis „${before.description}“ → „${after.description}“`)
  if (before.category !== after.category) changes.push(`kategorie ${before.category} → ${after.category}`)
  if (before.date !== after.date) changes.push(`datum ${formatDate(before.date)} → ${formatDate(after.date)}`)
  if ((before.paymentMethod ?? "cash") !== (after.paymentMethod ?? "cash")) changes.push(`platba ${payment(before.paymentMethod)} → ${payment(after.paymentMethod)}`)
  if (!!before.reimbursed !== !!after.reimbursed) changes.push(after.reimbursed ? "označeno jako proplacené" : "zrušeno proplacení")
  if ((before.paidBy ?? "") !== (after.paidBy ?? "")) changes.push(`platil ze svého: ${before.paidBy || "—"} → ${after.paidBy || "—"}`)
  if (before.receiptStorageId !== after.receiptStorageId) changes.push(after.receiptStorageId ? "účtenka přiložena" : "účtenka odebrána")
  return changes.length > 0 ? `${after.description}: ${changes.join("; ")}` : `${after.description}: beze změny`
}

export async function logAudit(
  ctx: MutationCtx,
  userId: Id<"users">,
  entry: {
    action: "create" | "update" | "delete" | "import"
    entityId?: string
    summary: string
    snapshot?: unknown
  }
) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first()
  await ctx.db.insert("auditLog", {
    at: Date.now(),
    userId,
    userName: profile?.name ?? "Neznámý uživatel",
    ...entry,
  })
}

// Výpis historie – jen pro hospodáře
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    if (!profile || profile.role !== "admin") return []
    return await ctx.db
      .query("auditLog")
      .withIndex("by_at")
      .order("desc")
      .take(Math.min(args.limit ?? 50, 500))
  },
})

// Obnovení smazané transakce z historie – jen pro hospodáře
export const restore = mutation({
  args: { id: v.id("auditLog") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Nepřihlášený uživatel")
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    if (!profile || profile.role !== "admin") throw new Error("Obnovit transakci může jen hospodář")

    const entry = await ctx.db.get(args.id)
    if (!entry || entry.action !== "delete" || !entry.snapshot) throw new Error("Tento záznam nelze obnovit")
    if (entry.restored) throw new Error("Transakce už byla obnovena")

    const t = entry.snapshot as Tx
    const receipt = t.receiptStorageId ? await ctx.storage.getUrl(t.receiptStorageId) : null
    const id = await ctx.db.insert("transactions", {
      type: t.type,
      amount: t.amount,
      description: t.description,
      category: t.category,
      paymentMethod: t.paymentMethod,
      reimbursed: t.reimbursed,
      paidBy: t.paidBy,
      date: t.date,
      receiptStorageId: receipt ? t.receiptStorageId : undefined,
      createdBy: t.createdBy,
      createdAt: t.createdAt,
    })
    await ctx.db.patch(args.id, { restored: true })
    const created = await ctx.db.get(id)
    if (created) await logAudit(ctx, userId, { action: "create", entityId: id, summary: `Obnoveno: ${describeTx(created)}` })
  },
})
