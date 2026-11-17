// Vygeneruje PNG ikony aplikace (PWA) z public/icon.svg – spouští se před `next build`.
// Používá knihovnu sharp, kterou instaluje Next.js. Když chybí, build pokračuje bez PNG.
import { readFileSync } from "node:fs"

const sizes = { "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180 }

try {
  const { default: sharp } = await import("sharp")
  const svg = readFileSync(new URL("../public/icon.svg", import.meta.url))
  for (const [name, size] of Object.entries(sizes)) {
    await sharp(svg, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(new URL(`../public/${name}`, import.meta.url).pathname)
  }
  console.log(`Ikony vygenerovány: ${Object.keys(sizes).join(", ")}`)
} catch (err) {
  console.warn("Ikony se nepodařilo vygenerovat:", err instanceof Error ? err.message : err)
}
