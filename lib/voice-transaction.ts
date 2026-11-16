// Rozpoznání transakce z věty, např.
//   "příjem dva tisíce pronájem hasičárny hotově"
//   "výdaj 850 nafta Tatra na účet včera"
// Výsledek slouží jen k předvyplnění formuláře – uživatel ho vždy zkontroluje.

export type VoiceCategory = { name: string; type: "income" | "expense" }

export type ParsedVoiceTransaction = {
  type?: "income" | "expense"
  amount?: number
  description: string
  category?: string
  paymentMethod?: "cash" | "bank"
  date?: string // YYYY-MM-DD
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

const INCOME_WORDS = new Set(["prijem", "prijmy", "prijato", "prijal", "prijala", "trzba", "trzby", "vynos"])
const EXPENSE_WORDS = new Set(["vydaj", "vydaje", "vydano", "zaplaceno", "zaplatil", "zaplatila", "platba", "nakup", "nakoupeno"])
const CASH_WORDS = new Set(["hotove", "hotovost", "hotovosti", "cash"])
const BANK_WORDS = new Set(["ucet", "uctu", "uctem", "banka", "banku", "bankou", "prevodem", "prevod", "kartou", "karta"])
const PAYMENT_PREPOSITIONS = new Set(["na", "v", "z", "pres", "do"])
const FILLER_WORDS = new Set(["korun", "koruna", "koruny", "kc", "kcs", "czk"])
const LEADING_FILLERS = new Set(["za", "na", "a", "od", "pro"])

const UNITS: Record<string, number> = {
  nula: 0, jeden: 1, jedna: 1, jedno: 1, dva: 2, dve: 2, tri: 3, ctyri: 4, pet: 5,
  sest: 6, sedm: 7, osm: 8, devet: 9, deset: 10, jedenact: 11, dvanact: 12,
  trinact: 13, ctrnact: 14, patnact: 15, sestnact: 16, sedmnact: 17, osmnact: 18,
  devatenact: 19, dvacet: 20, tricet: 30, ctyricet: 40, padesat: 50, sedesat: 60,
  sedmdesat: 70, osmdesat: 80, devadesat: 90,
}
const HUNDREDS = new Set(["sto", "ste", "sta", "set"])
const THOUSANDS = new Set(["tisic", "tisice", "tisicu"])

const MONTHS: Record<string, number> = {
  ledna: 1, unora: 2, brezna: 3, dubna: 4, kvetna: 5, cervna: 6, cervence: 7,
  srpna: 8, zari: 9, rijna: 10, listopadu: 11, prosince: 12,
}

const toIsoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function buildDate(day: number, month: number, year?: number): string | undefined {
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined
  const today = new Date()
  let y = year ?? today.getFullYear()
  if (y < 100) y += 2000
  const d = new Date(y, month - 1, day)
  // Bez roku a v budoucnosti → myšlen loňský rok
  if (!year && d.getTime() > today.getTime() + 24 * 3600 * 1000) d.setFullYear(y - 1)
  return toIsoLocal(d)
}

const isNumberToken = (t: string) =>
  /^\d+([.,]\d{1,2})?$/.test(t) || t in UNITS || HUNDREDS.has(t) || THOUSANDS.has(t)

export function parseVoiceTransaction(text: string, categories: VoiceCategory[]): ParsedVoiceTransaction {
  const original = text
    .replace(/(\d)\s*kč\b/gi, "$1")
    .split(/\s+/)
    .map((w) => w.replace(/^[„"'(]+|[,;:!?"“'")]+$/g, ""))
    .filter(Boolean)
  const tokens = original.map(norm)
  const used = new Array(tokens.length).fill(false)
  const result: ParsedVoiceTransaction = { description: "" }

  // 1) Datum
  for (let i = 0; i < tokens.length && !result.date; i++) {
    const t = tokens[i]
    if (t === "dnes" || t === "dneska") {
      result.date = toIsoLocal(new Date()); used[i] = true
    } else if (t === "vcera") {
      const d = new Date(); d.setDate(d.getDate() - 1); result.date = toIsoLocal(d); used[i] = true
    } else if (t === "predevcirem") {
      const d = new Date(); d.setDate(d.getDate() - 2); result.date = toIsoLocal(d); used[i] = true
    } else {
      let m = t.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/)
      if (m) {
        result.date = buildDate(+m[1], +m[2], m[3] ? +m[3] : undefined)
        if (result.date) used[i] = true
        continue
      }
      m = t.match(/^(\d{1,2})\.$/)
      const next = tokens[i + 1]
      if (m && next) {
        const month = MONTHS[next] ?? (/^\d{1,2}\.?$/.test(next) ? parseInt(next) : undefined)
        if (month) {
          const yearTok = tokens[i + 2]
          const year = yearTok && /^\d{4}$/.test(yearTok) ? +yearTok : undefined
          result.date = buildDate(+m[1], month, year)
          if (result.date) {
            used[i] = used[i + 1] = true
            if (year) used[i + 2] = true
          }
        }
      }
    }
  }

  // 2) Typ, způsob platby, výplňová slova
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue
    const t = tokens[i]
    if (INCOME_WORDS.has(t) && !result.type) { result.type = "income"; used[i] = true }
    else if (EXPENSE_WORDS.has(t) && !result.type) { result.type = "expense"; used[i] = true }
    else if (CASH_WORDS.has(t) || BANK_WORDS.has(t)) {
      result.paymentMethod ??= CASH_WORDS.has(t) ? "cash" : "bank"
      used[i] = true
      if (i > 0 && PAYMENT_PREPOSITIONS.has(tokens[i - 1])) used[i - 1] = true
    } else if (FILLER_WORDS.has(t)) used[i] = true
  }

  // 3) Částka – první souvislá skupina čísel / číslovek
  for (let i = 0; i < tokens.length && result.amount === undefined; i++) {
    if (used[i] || !isNumberToken(tokens[i])) continue
    let total = 0
    let current = 0
    let j = i
    for (; j < tokens.length && !used[j] && isNumberToken(tokens[j]); j++) {
      const t = tokens[j]
      if (/^\d/.test(t)) {
        let value = parseFloat(t.replace(",", "."))
        // "2 000" rozdělené mezerou
        while (j + 1 < tokens.length && /^\d{3}$/.test(tokens[j + 1]) && !t.includes(",") && !t.includes(".")) {
          value = value * 1000 + parseInt(tokens[j + 1]); j++
        }
        current += value
      } else if (t in UNITS) current += UNITS[t]
      else if (HUNDREDS.has(t)) current = (current || 1) * 100
      else if (THOUSANDS.has(t)) { total += (current || 1) * 1000; current = 0 }
    }
    const amount = total + current
    if (amount > 0) {
      result.amount = Math.round(amount * 100) / 100
      for (let k = i; k < j; k++) used[k] = true
    }
  }

  // 4) Kategorie – nejdelší shoda s názvem kategorie (bez diakritiky, i podle kmene slova)
  const free = tokens.filter((_, i) => !used[i])
  let best: { cat: VoiceCategory; score: number } | undefined
  for (const cat of categories) {
    if (result.type && cat.type !== result.type) continue
    const words = norm(cat.name).split(/[\s/,-]+/).filter((w) => w.length >= 3)
    let score = 0
    for (const w of words) {
      const stem = w.slice(0, Math.max(4, w.length - 2))
      if (free.some((t) => t === w || (t.length >= 4 && t.startsWith(stem)))) score += w.length
    }
    if (score > 0 && (!best || score > best.score)) best = { cat, score }
  }
  if (best) {
    result.category = best.cat.name
    result.type ??= best.cat.type
  }

  // 5) Popis – zbytek věty
  const rest = original.filter((_, i) => !used[i])
  while (rest.length > 1 && LEADING_FILLERS.has(norm(rest[0]))) rest.shift()
  let description = rest.join(" ").trim()
  if (!description && result.category) description = result.category
  result.description = description.charAt(0).toUpperCase() + description.slice(1)

  return result
}
