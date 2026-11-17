import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getApprovedUserId } from "./access";
import { Id } from "./_generated/dataModel";

// Výchozí kategorie
const defaultIncomeCategories = [
  "Dotace",
  "Členské příspěvky",
  "Sponzorský dar",
  "Akce",
  "Ostatní příjmy",
];

const defaultExpenseCategories = [
  "Vybavení",
  "PHM",
  "Údržba",
  "Školení",
  "Občerstvení",
  "Pojištění",
  "Ostatní výdaje",
];

// Získat všechny kategorie
export const list = query({
  args: {
    type: v.optional(v.union(v.literal("income"), v.literal("expense"))),
  },
  handler: async (ctx, args) => {
    const userId = await getApprovedUserId(ctx);
    if (!userId) return [];

    if (args.type) {
      return ctx.db
        .query("categories")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .collect();
    }

    return ctx.db.query("categories").collect();
  },
});

// Přidat kategorii
export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Zkontrolovat, zda je admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile || profile.role !== "admin") {
      throw new Error("Pouze admin může přidávat kategorie");
    }

    // Zkontrolovat, zda kategorie s tímto názvem již neexistuje
    const existing = await ctx.db
      .query("categories")
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), args.name),
          q.eq(q.field("type"), args.type)
        )
      )
      .first();

    if (existing) {
      throw new Error("Kategorie s tímto názvem již existuje");
    }

    return ctx.db.insert("categories", {
      name: args.name,
      type: args.type,
      createdAt: Date.now(),
    });
  },
});

// Popis kategorie (nepovinný) – pomáhá AI vybrat správnou kategorii
export const setDescription = mutation({
  args: {
    id: v.id("categories"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile || profile.role !== "admin") {
      throw new Error("Pouze admin může upravovat kategorie");
    }
    const description = args.description.trim().slice(0, 300);
    await ctx.db.patch(args.id, { description: description || undefined });
  },
});

// Interní: validace + přejmenování kategorie, vrátí starý název
export const internalRenameCategoryDoc = internalMutation({
  args: {
    id: v.id("categories"),
    name: v.string(),
    userId: v.id("users"),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile || profile.role !== "admin") {
      throw new Error("Pouze admin může upravovat kategorie");
    }

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Kategorie nenalezena");

    const newName = args.name.trim();
    if (!newName) throw new Error("Název nesmí být prázdný");

    const existing = await ctx.db
      .query("categories")
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), newName),
          q.eq(q.field("type"), category.type)
        )
      )
      .first();

    if (existing && existing._id !== args.id) {
      throw new Error("Kategorie s tímto názvem již existuje");
    }

    const oldName = category.name;
    await ctx.db.patch(args.id, { name: newName });

    // Rozpočty jsou vázané na název kategorie – přejmenovat i v nich
    if (oldName !== newName) {
      const budgets = await ctx.db.query("budgets").collect();
      for (const b of budgets) {
        if (b.category === oldName && b.type === category.type) {
          await ctx.db.patch(b._id, { category: newName });
        }
      }
    }
    return oldName;
  },
});

// Interní: získat ID transakcí s danou kategorií
export const internalGetTransactionIdsByCategory = internalQuery({
  args: { category: v.string() },
  returns: v.array(v.id("transactions")),
  handler: async (ctx, args): Promise<Id<"transactions">[]> => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
    return transactions.map((t) => t._id);
  },
});

// Interní: aktualizovat dávku transakcí
export const internalUpdateTransactionCategoryBatch = internalMutation({
  args: {
    ids: v.array(v.id("transactions")),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.patch(id, { category: args.category });
    }
  },
});

// Přejmenovat kategorii a aktualizovat všechny transakce (zpracováno dávkově)
export const rename = action({
  args: {
    id: v.id("categories"),
    name: v.string(),
  },
  returns: v.object({ updatedTransactions: v.number() }),
  handler: async (ctx, args): Promise<{ updatedTransactions: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Přejmenovat kategorii a získat starý název
    const oldName: string = await ctx.runMutation(internal.categories.internalRenameCategoryDoc, {
      id: args.id,
      name: args.name,
      userId,
    });

    // Získat všechna ID transakcí se starým názvem
    const ids: Id<"transactions">[] = await ctx.runQuery(internal.categories.internalGetTransactionIdsByCategory, {
      category: oldName,
    });

    console.log(`Přejmenovávám kategorii "${oldName}" -> "${args.name}", aktualizuji ${ids.length} transakcí`);

    // Dávkové aktualizace po 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      await ctx.runMutation(internal.categories.internalUpdateTransactionCategoryBatch, {
        ids: ids.slice(i, i + BATCH_SIZE),
        category: args.name.trim(),
      });
    }

    return { updatedTransactions: ids.length };
  },
});

// Smazat kategorii
export const remove = mutation({
  args: {
    id: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Zkontrolovat, zda je admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile || profile.role !== "admin") {
      throw new Error("Pouze admin může mazat kategorie");
    }

    await ctx.db.delete(args.id);
  },
});

// Načíst výchozí kategorie (může volat admin)
export const loadDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Zkontrolovat, zda je admin
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile || profile.role !== "admin") {
      throw new Error("Pouze admin může načíst výchozí kategorie");
    }

    console.log("Načítám výchozí kategorie");

    // Přidat výchozí kategorie příjmů (pokud neexistují)
    for (const name of defaultIncomeCategories) {
      const existing = await ctx.db
        .query("categories")
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), name),
            q.eq(q.field("type"), "income")
          )
        )
        .first();

      if (!existing) {
        await ctx.db.insert("categories", {
          name,
          type: "income",
          createdAt: Date.now(),
        });
      }
    }

    // Přidat výchozí kategorie výdajů (pokud neexistují)
    for (const name of defaultExpenseCategories) {
      const existing = await ctx.db
        .query("categories")
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), name),
            q.eq(q.field("type"), "expense")
          )
        )
        .first();

      if (!existing) {
        await ctx.db.insert("categories", {
          name,
          type: "expense",
          createdAt: Date.now(),
        });
      }
    }

    console.log("Výchozí kategorie načteny");
  },
});
