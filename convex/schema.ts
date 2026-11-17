import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

export default defineSchema({
  ...authTables,
  
  // Rozšíření uživatelů o role
  userProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("secretary"), v.literal("deputy"), v.literal("member")),
    approved: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
  
  // Transakce (příjmy a výdaje)
  transactions: defineTable({
    type: v.union(v.literal("income"), v.literal("expense")),
    amount: v.number(),
    description: v.string(),
    category: v.string(),
    paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("bank"))),
    reimbursed: v.optional(v.boolean()),
    // Kdo výdaj zaplatil ze svého a čeká na proplacení
    paidBy: v.optional(v.string()),
    date: v.number(),
    receiptStorageId: v.optional(v.id("_storage")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_date", ["date"])
    .index("by_category", ["category"])
    .index("by_paymentMethod", ["paymentMethod"]),
  
  // Členové sboru
  members: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    memberType: v.optional(v.union(v.literal("man"), v.literal("woman"), v.literal("child"))),
    birthDate: v.optional(v.number()),
    joinedAt: v.number(),
    active: v.boolean(),
    over60: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_active", ["active"])
    .index("by_memberType", ["memberType"])
    .index("by_lastName", ["lastName"]),
  
  // Členské příspěvky
  membershipFees: defineTable({
    memberId: v.id("members"),
    year: v.number(),
    amount: v.number(),
    paidAt: v.optional(v.number()),
    paymentMethod: v.optional(v.union(v.literal("cash"), v.literal("bank"))),
    status: v.union(v.literal("paid"), v.literal("unpaid"), v.literal("exempt")),
    createdAt: v.number(),
  })
    .index("by_memberId", ["memberId"])
    .index("by_year", ["year"])
    .index("by_status", ["status"]),
  
  // Kategorie příjmů a výdajů
  categories: defineTable({
    name: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    // Nepovinný popis – pomáhá AI vybrat správnou kategorii
    description: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_name", ["name"]),
  
  // Tokeny pro reset hesla
  passwordResetTokens: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    attempts: v.optional(v.number()),
  }).index("by_email", ["email"]),

  // Inventury hotovosti v pokladně
  cashCounts: defineTable({
    countedAt: v.number(),
    counted: v.number(),
    expected: v.number(),
    difference: v.number(),
    // Počty kusů podle nominálu, např. { "2000": 5, "1000": 8 }
    denominations: v.optional(v.record(v.string(), v.number())),
    transactionId: v.optional(v.id("transactions")),
    createdBy: v.id("users"),
  }).index("by_countedAt", ["countedAt"]),

  // Rozpočet: plánovaná částka pro kategorii v daném roce
  budgets: defineTable({
    year: v.number(),
    category: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    amount: v.number(),
    updatedAt: v.number(),
  }).index("by_year", ["year"]),

  // Historie změn transakcí (kdo, kdy, co)
  auditLog: defineTable({
    at: v.number(),
    userId: v.id("users"),
    userName: v.string(),
    action: v.union(v.literal("create"), v.literal("update"), v.literal("delete"), v.literal("import")),
    entityId: v.optional(v.string()),
    summary: v.string(),
    // Kopie smazané transakce, aby šla dohledat
    snapshot: v.optional(v.any()),
    restored: v.optional(v.boolean()),
  }).index("by_at", ["at"]),

  // Nastavení aplikace
  appSettings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
})
