// Rozpoznání transakce pomocí Claude API – z věty (hlasové zadání) nebo z fotky účtenky.
//
// Proměnné prostředí v Convexu:
//   ANTHROPIC_API_KEY – API klíč z console.anthropic.com
//   AI_MODEL          – volitelně jiný model (výchozí claude-haiku-5-5)
//
// Klíč zůstává jen na serveru. Výsledek slouží k předvyplnění formuláře,
// uživatel ho vždy zkontroluje a uloží sám.

import { action, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

export type AiTransaction = {
  type?: "income" | "expense"
  amount?: number
  description?: string
  category?: string
  paymentMethod?: "cash" | "bank"
  date?: string
}

type AiResult = { ok: true; data: AiTransaction } | { ok: false; error: string }

const DEFAULT_MODEL = "claude-haiku-5-5"
const MAX_IMAGE_BASE64 = 6_000_000 // ~4,5 MB obrázku

export const internalCategories = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("categories").collect()
    return all.map((c) => ({ name: c.name, type: c.type, description: c.description }))
  },
})

const TOOL_NAME = "zapsat_transakci"

// Kategorie se AI nabízí včetně typu, aby výdaj nedostal kategorii příjmů
const TYPE_LABEL = { income: "příjem", expense: "výdaj" } as const
const categoryOption = (c: { name: string; type: string }) =>
  `${TYPE_LABEL[c.type as "income" | "expense"] ?? c.type} / ${c.name}`

// Nástroj se sestavuje pro každý dotaz, aby kategorie byla pevný výběr ze seznamu
const buildTool = (categoryOptions: string[]) => ({
  name: TOOL_NAME,
  description: "Zapíše rozpoznanou transakci do pokladny hasičského sboru.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["income", "expense"],
        description: "income = příjem, expense = výdaj. Účtenka z obchodu je téměř vždy výdaj.",
      },
      amount: { type: "number", description: "Celková částka v Kč (u účtenky řádek CELKEM / K ÚHRADĚ, ne mezisoučet ani DPH)." },
      description: { type: "string", description: "Krátký český popis, např. 'Hornbach – hadice, spojka' nebo 'Pronájem hasičárny'." },
      category: {
        type: "string",
        enum: [...categoryOptions, ""],
        description: "Nejbližší vhodná kategorie ve tvaru 'typ / název'. Typ musí odpovídat poli type (výdaj = expense, příjem = income). Prázdný řetězec jen tehdy, když opravdu žádná nesouvisí.",
      },
      paymentMethod: {
        type: "string",
        enum: ["cash", "bank"],
        description: "cash = hotovost; bank = účet, převod nebo platba kartou. Pokud nelze určit, vynech.",
      },
      date: { type: "string", description: "Datum ve formátu YYYY-MM-DD. Pokud nelze určit, vynech." },
    },
    required: ["type", "amount", "description", "category"],
  },
})

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim()

function validate(raw: Record<string, unknown>, categories: { name: string; type: string }[]): AiTransaction {
  const out: AiTransaction = {}
  if (raw.type === "income" || raw.type === "expense") out.type = raw.type
  const amount = typeof raw.amount === "number" ? raw.amount : parseFloat(String(raw.amount ?? "").replace(",", "."))
  if (isFinite(amount) && amount > 0) out.amount = Math.round(amount * 100) / 100
  if (typeof raw.description === "string" && raw.description.trim()) out.description = raw.description.trim().slice(0, 200)
  if (typeof raw.category === "string") {
    const wanted = normalize(raw.category)
    // Přijímá "výdaj / Název" i samotný "Název"; kategorie musí sedět k typu transakce
    const match = categories.find(
      (c) =>
        (normalize(categoryOption(c)) === wanted || normalize(c.name) === wanted) &&
        (!out.type || c.type === out.type)
    )
    if (match) {
      out.category = match.name
      out.type ??= match.type as "income" | "expense"
    }
  }
  if (raw.paymentMethod === "cash" || raw.paymentMethod === "bank") out.paymentMethod = raw.paymentMethod
  if (typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) out.date = raw.date
  return out
}

export const parseTransaction = action({
  args: {
    text: v.optional(v.string()),
    imageBase64: v.optional(v.string()),
    imageMediaType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AiResult> => {
    const role = await ctx.runQuery(internal.access.internalCurrentRole, {})
    if (role !== "admin" && role !== "deputy") return { ok: false, error: "Nemáte oprávnění" }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { ok: false, error: "AI není nastavená (chybí ANTHROPIC_API_KEY)" }

    if (!args.text && !args.imageBase64) return { ok: false, error: "Chybí text nebo obrázek" }
    if (args.text && args.text.length > 2000) return { ok: false, error: "Text je příliš dlouhý" }
    if (args.imageBase64 && args.imageBase64.length > MAX_IMAGE_BASE64) {
      return { ok: false, error: "Obrázek je příliš velký" }
    }

    const categories = await ctx.runQuery(internal.ai.internalCategories, {})
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" })
    // Kategorie i s popisem, pokud ho hospodář vyplnil – AI pak líp trefí správnou
    const categoryList = (t: string) =>
      categories
        .filter((c) => c.type === t)
        .map((c) => (c.description ? `${c.name} (${c.description})` : c.name))
        .join(", ") || "(žádné)"

    const system = [
      "Jsi pomocník hospodáře sboru dobrovolných hasičů SDH Bor. Z podkladu rozpoznej jednu transakci a zapiš ji nástrojem zapsat_transakci.",
      `Dnešní datum je ${today}. Relativní data (včera, minulý pátek) přepočítej podle něj.`,
      `Povolené kategorie příjmů: ${categoryList("income")}.`,
      `Povolené kategorie výdajů: ${categoryList("expense")}.`,
      "Vždy vyber nejbližší vhodnou kategorii ze seznamu podle obsahu (např. nápoje a jídlo k akci, materiál k vybavení). U výdaje vybírej jen z kategorií výdajů, u příjmu jen z kategorií příjmů. Prázdnou ji nech jen tehdy, když opravdu žádná nesouvisí. Hospodář návrh před uložením zkontroluje.",
      "Částky jsou v Kč. Nevymýšlej údaje, které v podkladu nejsou.",
    ].join("\n")

    const content: unknown[] = []
    if (args.imageBase64) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: args.imageMediaType || "image/jpeg", data: args.imageBase64 },
      })
      content.push({ type: "text", text: "Toto je fotka účtenky nebo dokladu. Rozpoznej z ní transakci." })
    } else {
      content.push({ type: "text", text: `Hospodář nadiktoval: „${args.text}“` })
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || DEFAULT_MODEL,
          max_tokens: 500,
          system,
          tools: [buildTool(Array.from(new Set(categories.map(categoryOption))))],
          tool_choice: { type: "tool", name: TOOL_NAME },
          messages: [{ role: "user", content }],
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        console.log("Claude API chyba:", response.status, body.slice(0, 500))
        if (response.status === 401) return { ok: false, error: "Neplatný API klíč" }
        if (response.status === 402 || /credit/i.test(body)) return { ok: false, error: "Došel kredit na API" }
        return { ok: false, error: `AI neodpověděla (${response.status})` }
      }

      const json = (await response.json()) as { content?: { type: string; input?: Record<string, unknown> }[] }
      const toolUse = json.content?.find((c) => c.type === "tool_use")
      if (!toolUse?.input) return { ok: false, error: "AI nevrátila výsledek" }

      const data = validate(toolUse.input, categories)
      console.log("AI rozpoznala transakci:", JSON.stringify(data))
      return { ok: true, data }
    } catch (e) {
      console.log("Claude API výjimka:", e)
      return { ok: false, error: "Nepodařilo se spojit s AI" }
    }
  },
})
