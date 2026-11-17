// Zmenší obrázek (delší strana max. maxSide px) a vrátí ho jako base64 JPEG bez prefixu data:.
// Pro AI stačí ~1600 px; k transakci se dál ukládá původní ořezaná fotka.
export async function imageToBase64Jpeg(blob: Blob, maxSide = 1600, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("Obrázek se nepodařilo načíst"))
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", quality)
    return dataUrl.slice(dataUrl.indexOf(",") + 1)
  } finally {
    URL.revokeObjectURL(url)
  }
}
