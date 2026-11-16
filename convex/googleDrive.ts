"use node"

import { internalAction, action } from "./_generated/server"
import { internal } from "./_generated/api"
import * as XLSX from "xlsx"
import { createSign } from "crypto"

const FILE_NAME = "SDH-BOR-Transakce.xlsx"

// --- Google Auth (JWT + OAuth2) ---

function createJWT(email: string, privateKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url")

  const signingInput = `${header}.${payload}`
  const sign = createSign("RSA-SHA256")
  sign.update(signingInput)
  const signature = sign.sign(privateKey, "base64url")

  return `${signingInput}.${signature}`
}

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const jwt = createJWT(email, privateKey)
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  const data = await response.json() as { access_token?: string; error?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(`Google auth failed: ${data.error} - ${data.error_description}`)
  }
  return data.access_token
}

// --- Google Drive API (přímé HTTP volání) ---

async function findFile(accessToken: string, folderId: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json() as { files?: Array<{ id: string }> }
  return data.files && data.files.length > 0 ? data.files[0].id : null
}

async function uploadFile(accessToken: string, folderId: string, buffer: Buffer): Promise<string> {
  const metadata = JSON.stringify({
    name: FILE_NAME,
    parents: [folderId],
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  // Multipart upload
  const boundary = "boundary_sdh_bor"
  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
  ]
  const ending = `\r\n--${boundary}--`

  const bodyStart = Buffer.from(bodyParts.join(""))
  const bodyEnd = Buffer.from(ending)
  const body = Buffer.concat([bodyStart, buffer, bodyEnd])

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  const data = await res.json() as { id?: string; error?: unknown }
  if (!data.id) throw new Error(`Upload failed: ${JSON.stringify(data.error)}`)
  return data.id
}

async function updateFile(accessToken: string, fileId: string, buffer: Buffer): Promise<void> {
  const boundary = "boundary_sdh_bor"
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n`
  const mediaPart = `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
  const ending = `\r\n--${boundary}--`
  const body = Buffer.concat([Buffer.from(metaPart + mediaPart), buffer, Buffer.from(ending)])

  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&supportsAllDrives=true`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Update failed: ${err}`)
  }
}

// --- Pomocné funkce ---

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("cs-CZ")
}

function translatePaymentMethod(method?: string): string {
  if (method === "cash") return "Hotovost"
  if (method === "bank") return "Banka"
  return ""
}

function translateType(type: string): string {
  if (type === "income") return "Příjem"
  if (type === "expense") return "Výdaj"
  return type
}

// --- Hlavní akce ---

export const syncToGoogleDrive = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("[GoogleDrive] Spouštím synchronizaci transakcí...")

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n")
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!email || !privateKey || !folderId) {
      console.error("[GoogleDrive] Chybí environment proměnné:", { email: !!email, privateKey: !!privateKey, folderId: !!folderId })
      return
    }

    const transactions: Array<{
      _id: string
      type: string
      amount: number
      description: string
      category: string
      paymentMethod?: string
      reimbursed?: boolean
      date: number
      createdAt: number
    }> = await ctx.runQuery(internal.transactions.listAll)

    console.log(`[GoogleDrive] Načteno ${transactions.length} transakcí`)

    const sorted = [...transactions].sort((a, b) => b.date - a.date)

    // --- Workbook ---
    const wb = XLSX.utils.book_new()

    // Všechny transakce
    const allRows = sorted.map((t) => ({
      Datum: formatDate(t.date),
      Typ: translateType(t.type),
      Popis: t.description,
      Kategorie: t.category,
      "Způsob platby": translatePaymentMethod(t.paymentMethod),
      "Částka (Kč)": t.type === "income" ? t.amount : -t.amount,
      Proplaceno: t.reimbursed ? "Ano" : "",
    }))
    const wsAll = XLSX.utils.json_to_sheet(allRows)
    wsAll["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 35 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsAll, "Transakce")

    // Příjmy
    const incomeRows = sorted.filter((t) => t.type === "income").map((t) => ({
      Datum: formatDate(t.date),
      Popis: t.description,
      Kategorie: t.category,
      "Způsob platby": translatePaymentMethod(t.paymentMethod),
      "Částka (Kč)": t.amount,
    }))
    const wsIncome = XLSX.utils.json_to_sheet(incomeRows)
    wsIncome["!cols"] = [{ wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsIncome, "Příjmy")

    // Výdaje
    const expenseRows = sorted.filter((t) => t.type === "expense").map((t) => ({
      Datum: formatDate(t.date),
      Popis: t.description,
      Kategorie: t.category,
      "Způsob platby": translatePaymentMethod(t.paymentMethod),
      "Částka (Kč)": t.amount,
      Proplaceno: t.reimbursed ? "Ano" : "",
    }))
    const wsExpense = XLSX.utils.json_to_sheet(expenseRows)
    wsExpense["!cols"] = [{ wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsExpense, "Výdaje")

    // Souhrn
    const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    const wsSummary = XLSX.utils.json_to_sheet([
      { Položka: "Celkové příjmy", "Částka (Kč)": totalIncome },
      { Položka: "Celkové výdaje", "Částka (Kč)": totalExpense },
      { Položka: "Zůstatek", "Částka (Kč)": totalIncome - totalExpense },
    ])
    wsSummary["!cols"] = [{ wch: 22 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, "Souhrn")

    const excelBuffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    // --- Nahrát na Google Drive ---
    const accessToken = await getAccessToken(email, privateKey)
    const existingFileId = await findFile(accessToken, folderId)

    if (existingFileId) {
      await updateFile(accessToken, existingFileId, excelBuffer)
      console.log(`[GoogleDrive] Soubor aktualizován (ID: ${existingFileId})`)
    } else {
      const newId = await uploadFile(accessToken, folderId, excelBuffer)
      console.log(`[GoogleDrive] Nový soubor vytvořen (ID: ${newId})`)
    }

    console.log("[GoogleDrive] Synchronizace dokončena ✓")
  },
})

// Testovací akce — volatelná z klienta, vrací detailní chybové hlášení
export const testSync = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; message: string; detail?: string }> => {
    const role = await ctx.runQuery(internal.access.internalCurrentRole, {})
    if (role !== "admin") {
      return { ok: false, message: "Nemáte oprávnění" }
    }
    try {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n")
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

      console.log("[TestSync] email:", email ? "OK" : "CHYBÍ")
      console.log("[TestSync] privateKey:", privateKey ? "OK" : "CHYBÍ")
      console.log("[TestSync] folderId:", folderId ? `OK (${folderId})` : "CHYBÍ")

      if (!email || !privateKey || !folderId) {
        return {
          ok: false,
          message: "Chybí přihlašovací údaje",
          detail: `email: ${!!email}, privateKey: ${!!privateKey}, folderId: ${!!folderId}`,
        }
      }

      // Test autentizace
      let accessToken: string
      try {
        accessToken = await getAccessToken(email, privateKey)
        console.log("[TestSync] Auth OK")
      } catch (e) {
        return { ok: false, message: "Chyba autentizace Google", detail: String(e) }
      }

      // Test přístupu ke složce
      try {
        const existingId = await findFile(accessToken, folderId)
        console.log("[TestSync] Folder přístup OK, existující soubor:", existingId ?? "žádný")
      } catch (e) {
        return { ok: false, message: "Chyba přístupu ke složce Drive", detail: String(e) }
      }

      // Spustit plnou synchronizaci
      await ctx.runAction(internal.googleDrive.syncToGoogleDrive, {})
      return { ok: true, message: "Synchronizace proběhla úspěšně! Soubor byl nahrán na Google Drive." }
    } catch (e) {
      console.error("[TestSync] Neočekávaná chyba:", e)
      return { ok: false, message: "Neočekávaná chyba", detail: String(e) }
    }
  },
})
